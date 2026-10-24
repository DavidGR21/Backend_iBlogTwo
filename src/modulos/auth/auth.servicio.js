/**
 * Reglas de negocio de auth. Usa lib/cifrado (correo), lib/clave (Argon2),
 * lib/tokens y lib/correo.
 *
 * Reglas clave:
 *  - Registro en una transacción: usuarios + perfiles + tokens_usuario.
 *  - Login con nombre de usuario o correo: si lleva "@" busca por
 *    hmac(normalizarCorreo(correo)); si no, por nombre de usuario. Exige correo verificado.
 *  - Mensaje de error genérico en login ("usuario/correo o clave incorrectos").
 *  - "Olvidé mi clave" responde igual exista o no el correo (no revelar cuentas).
 *  - Los tokens se marcan como usados (usado_en) y se rechazan si expiraron.
 *  - Refresh token rotativo: cada /refrescar revoca la sesión y crea una nueva.
 *  - Token de sesión de 1 día (sin BD): login y /refrescar lo entregan; /restaurar lo
 *    canjea por un token de acceso cuando la cookie del refresh token ya no está.
 */
import { urlFrontend } from '../../config/env.js';
import { enTransaccion } from '../../db/transaccion.js';
import { ErrorApp } from '../../errores/ErrorApp.js';
import { cifrar, hmac, normalizarCorreo } from '../../lib/cifrado.js';
import { hashearClave, verificarClave } from '../../lib/clave.js';
import { enviarCorreo } from '../../lib/correo.js';
import { logger } from '../../lib/logger.js';
import {
  firmarTokenAcceso,
  firmarTokenSesion,
  generarTokenAleatorio,
  hashToken,
  huellaClave,
  verificarTokenSesion,
} from '../../lib/tokens.js';
import * as usuarios from '../usuarios/usuarios.servicio.js';
import * as repositorio from './auth.repositorio.js';
import { correoRecuperarClave, correoVerificacion } from './auth.correos.js';

export const DIAS_SESION = 30;
const MINUTOS_VERIFICACION = 24 * 60;
const MINUTOS_RESTABLECER = 60;

const MENSAJE_VERIFICACION =
  'Si la cuenta existe y no está verificada, te enviamos un nuevo enlace de verificación.';
const MENSAJE_RECUPERAR =
  'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';

const tokenInvalido = () =>
  new ErrorApp(400, 'TOKEN_INVALIDO', 'El enlace no es válido o ya expiró. Pide uno nuevo.');

const credencialesInvalidas = () =>
  new ErrorApp(401, 'CREDENCIALES_INVALIDAS', 'Usuario, correo o contraseña incorrectos');

// Hash ficticio para que el login tarde lo mismo exista o no la cuenta.
let hashFicticio = null;
const obtenerHashFicticio = () => (hashFicticio ??= hashearClave('clave-ficticia-para-tiempos'));

/** Envía el correo sin romper la petición si Brevo falla (el usuario puede pedir reenvío). */
async function enviarSinFallar(datos) {
  try {
    await enviarCorreo(datos);
  } catch (err) {
    logger.error({ err, asunto: datos.asunto }, 'No se pudo enviar el correo');
  }
}

async function crearTokenDeCorreo(usuarioId, proposito, minutos, db) {
  const { token, hash } = generarTokenAleatorio();
  await repositorio.anularTokens(usuarioId, proposito, db);
  await repositorio.crearToken({ usuarioId, proposito, tokenHash: hash, minutos }, db);
  return token;
}

async function enviarVerificacion({ correo, nombre, token }) {
  const enlace = `${urlFrontend}/verificar-correo?token=${encodeURIComponent(token)}`;
  await enviarSinFallar({ para: correo, ...correoVerificacion({ nombre, enlace }) });
}

// ── Registro y verificación ─────────────────────────

export async function registrar({ nombreUsuario, correo, clave, nombres, apellidos, paisCodigo }) {
  const correoNormal = normalizarCorreo(correo);
  const claveHash = await hashearClave(clave);

  let token;
  try {
    token = await enTransaccion(async (db) => {
      const usuario = await repositorio.crearUsuario(
        {
          nombreUsuario,
          correoCifrado: cifrar(correoNormal),
          correoHash: hmac(correoNormal),
          claveHash,
        },
        db,
      );
      await repositorio.crearPerfil(usuario.id, { nombres, apellidos, paisCodigo }, db);
      return crearTokenDeCorreo(usuario.id, 'verificacion_correo', MINUTOS_VERIFICACION, db);
    });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'usuarios_nombre_usuario_key') {
      throw ErrorApp.conflicto('Ese nombre de usuario ya está en uso');
    }
    if (error.code === '23505' && error.constraint === 'usuarios_correo_hash_key') {
      throw ErrorApp.conflicto('Ya existe una cuenta con ese correo');
    }
    if (error.code === '23503') throw ErrorApp.solicitudInvalida('País inválido');
    throw error;
  }

  await enviarVerificacion({ correo: correoNormal, nombre: nombres, token });
  return { mensaje: 'Cuenta creada. Revisa tu correo para verificarla.' };
}

export async function verificarCorreo(token) {
  const usuarioId = await repositorio.consumirToken(hashToken(token), 'verificacion_correo');
  if (!usuarioId) throw tokenInvalido();
  await repositorio.marcarCorreoVerificado(usuarioId);
  return { mensaje: '¡Correo verificado! Ya puedes ingresar.' };
}

export async function reenviarVerificacion(correo) {
  const correoNormal = normalizarCorreo(correo);
  const usuario = await repositorio.buscarPorCorreoHash(hmac(correoNormal));

  if (usuario && usuario.estado === 'activo' && !usuario.correo_verificado_en) {
    const token = await crearTokenDeCorreo(usuario.id, 'verificacion_correo', MINUTOS_VERIFICACION);
    await enviarVerificacion({ correo: correoNormal, nombre: usuario.nombres, token });
  }
  return { mensaje: MENSAJE_VERIFICACION };
}

// ── Sesión ──────────────────────────────────────────

async function abrirSesion(usuarioId, { agenteUsuario, ip }, db) {
  const { token: refreshToken, hash } = generarTokenAleatorio(48);
  await repositorio.crearSesion(
    { usuarioId, refreshHash: hash, agenteUsuario, ip, dias: DIAS_SESION },
    db,
  );
  return refreshToken;
}

/**
 * Devuelve { tokenAcceso, tokenSesion, usuario, refreshToken }.
 * El controlador pone refreshToken en la cookie.
 */
export async function iniciarSesion({ identificador, clave }, meta) {
  const usuario = identificador.includes('@')
    ? await repositorio.buscarPorCorreoHash(hmac(normalizarCorreo(identificador)))
    : await repositorio.buscarPorNombreUsuario(identificador);

  if (!usuario) {
    await verificarClave(await obtenerHashFicticio(), clave);
    throw credencialesInvalidas();
  }
  if (!(await verificarClave(usuario.clave_hash, clave))) throw credencialesInvalidas();

  if (usuario.estado === 'suspendido') {
    const motivo = usuario.motivo_suspension ? ` Motivo: ${usuario.motivo_suspension}` : '';
    throw new ErrorApp(
      403,
      'CUENTA_SUSPENDIDA',
      `Tu cuenta fue suspendida por un administrador.${motivo}`,
    );
  }
  if (usuario.estado !== 'activo') throw ErrorApp.prohibido('Tu cuenta no está activa');
  if (!usuario.correo_verificado_en) {
    throw new ErrorApp(
      403,
      'CORREO_NO_VERIFICADO',
      'Debes verificar tu correo antes de ingresar. Revisa tu bandeja de entrada.',
    );
  }

  const refreshToken = await abrirSesion(usuario.id, meta);
  await repositorio.registrarAcceso(usuario.id);

  return {
    tokenAcceso: firmarTokenAcceso(usuario.id),
    tokenSesion: firmarTokenSesion(usuario.id, usuario.clave_hash),
    usuario: await usuarios.obtenerYo(usuario.id),
    refreshToken,
  };
}

export async function refrescar(refreshToken, meta) {
  if (!refreshToken) throw ErrorApp.noAutenticado('No hay una sesión activa');

  const resultado = await enTransaccion(async (db) => {
    const usuarioId = await repositorio.revocarSesionVigente(hashToken(refreshToken), db);
    if (!usuarioId) return null;

    const usuario = await repositorio.buscarPorId(usuarioId, db);
    if (!usuario || usuario.estado !== 'activo') return null;

    return {
      usuarioId,
      claveHash: usuario.clave_hash,
      refreshToken: await abrirSesion(usuarioId, meta, db),
    };
  });

  if (!resultado) throw ErrorApp.noAutenticado('La sesión expiró, vuelve a ingresar');

  await repositorio.registrarAcceso(resultado.usuarioId);
  return {
    tokenAcceso: firmarTokenAcceso(resultado.usuarioId),
    tokenSesion: firmarTokenSesion(resultado.usuarioId, resultado.claveHash),
    usuario: await usuarios.obtenerYo(resultado.usuarioId),
    refreshToken: resultado.refreshToken,
  };
}

/**
 * Recupera la sesión con el token de sesión de 1 día cuando la cookie no está
 * (navegador reiniciado, cookies de terceros bloqueadas…). No escribe en la BD:
 * solo comprueba que el usuario siga activo y que su clave no haya cambiado.
 * No renueva el token de sesión, así la sesión sin cookie dura como máximo un día.
 */
export async function restaurar(tokenSesion) {
  const sesionExpirada = () => ErrorApp.noAutenticado('La sesión expiró, vuelve a ingresar');

  let contenido;
  try {
    contenido = verificarTokenSesion(tokenSesion);
  } catch {
    throw sesionExpirada();
  }

  const usuario = await repositorio.buscarPorId(contenido.id);
  if (
    !usuario ||
    usuario.estado !== 'activo' ||
    huellaClave(usuario.clave_hash) !== contenido.huella
  ) {
    throw sesionExpirada();
  }

  return {
    tokenAcceso: firmarTokenAcceso(usuario.id),
    usuario: await usuarios.obtenerYo(usuario.id),
  };
}

export async function cerrarSesion(refreshToken) {
  if (refreshToken) await repositorio.revocarSesionVigente(hashToken(refreshToken));
}

// ── Administración ──────────────────────────────────

/** Cierra todas las sesiones de un usuario (p. ej. al suspender su cuenta). */
export const revocarSesiones = (usuarioId) => repositorio.revocarTodasLasSesiones(usuarioId);

/** Un administrador marca el correo como verificado (si el correo nunca le llegó). */
export const verificarCorreoManual = (usuarioId) => repositorio.marcarCorreoVerificado(usuarioId);

// ── Recuperar clave ─────────────────────────────────

export async function olvideClave(correo) {
  const correoNormal = normalizarCorreo(correo);
  const usuario = await repositorio.buscarPorCorreoHash(hmac(correoNormal));

  if (usuario && usuario.estado === 'activo') {
    const token = await crearTokenDeCorreo(usuario.id, 'restablecer_clave', MINUTOS_RESTABLECER);
    const enlace = `${urlFrontend}/restablecer-clave?token=${encodeURIComponent(token)}`;
    await enviarSinFallar({
      para: correoNormal,
      ...correoRecuperarClave({ nombre: usuario.nombres, enlace }),
    });
  }
  return { mensaje: MENSAJE_RECUPERAR };
}

export async function restablecerClave({ token, clave }) {
  const claveHash = await hashearClave(clave);

  const usuarioId = await enTransaccion(async (db) => {
    const id = await repositorio.consumirToken(hashToken(token), 'restablecer_clave', db);
    if (!id) return null;
    await repositorio.actualizarClave(id, claveHash, db);
    // Abrir el enlace del correo demuestra que el correo es suyo.
    await repositorio.marcarCorreoVerificado(id, db);
    await repositorio.revocarTodasLasSesiones(id, db);
    return id;
  });

  if (!usuarioId) throw tokenInvalido();
  return { mensaje: 'Contraseña actualizada. Ya puedes ingresar con la nueva.' };
}
