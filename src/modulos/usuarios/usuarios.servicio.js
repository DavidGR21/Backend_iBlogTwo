/**
 * Servicio: reglas de negocio del módulo. No sabe nada de HTTP (ni req ni res),
 * así se puede reutilizar desde rutas, sockets o pruebas.
 *
 * Exporta también, para otros módulos:
 *  - armarResumen(fila): fila de v_usuarios_resumen → UsuarioResumen (firma la foto).
 *  - obtenerResumen(id): UsuarioResumen de un usuario activo, o null.
 *  - esAdmin(id), buscarRolYEstado(id), suspender, reactivar y quitarFotoComoModerador:
 *    los usan el middleware exigirAdmin y el módulo admin.
 */
import { ErrorApp } from '../../errores/ErrorApp.js';
import { urlParaVer } from '../../lib/almacenamiento.js';
import { cifrar } from '../../lib/cifrado.js';
import { logger } from '../../lib/logger.js';
import * as amistades from '../amistades/amistades.servicio.js';
import * as archivos from '../archivos/archivos.servicio.js';
import * as repositorio from './usuarios.repositorio.js';
import { aPerfilPublico, aUsuarioResumen, aUsuarioYo } from './usuarios.mapeador.js';

const urlFoto = (clave) => (clave ? urlParaVer(clave) : null);

export async function armarResumen(fila) {
  return aUsuarioResumen(fila, { fotoPerfilUrl: await urlFoto(fila.foto_perfil_clave) });
}

export async function obtenerResumen(usuarioId) {
  const fila = await repositorio.buscarResumen(usuarioId);
  return fila ? armarResumen(fila) : null;
}

export async function obtenerPerfilPublico(nombreUsuario, visitanteId = null) {
  const fila = await repositorio.buscarPerfilPublico(nombreUsuario);
  if (!fila) throw ErrorApp.noEncontrado('Usuario no encontrado');

  const [fotoPerfilUrl, amistad] = await Promise.all([
    urlFoto(fila.foto_perfil_clave),
    visitanteId && visitanteId !== fila.id ? amistades.obtenerRelacion(visitanteId, fila.id) : null,
  ]);
  return aPerfilPublico(fila, { fotoPerfilUrl, amistad });
}

export async function obtenerYo(usuarioId) {
  const fila = await repositorio.buscarCuenta(usuarioId);
  if (!fila) throw ErrorApp.noAutenticado('La cuenta ya no existe');
  return aUsuarioYo(fila, { fotoPerfilUrl: await urlFoto(fila.foto_perfil_clave) });
}

export async function actualizarPerfil(usuarioId, datos) {
  const actual = await repositorio.buscarCuenta(usuarioId);
  if (!actual) throw ErrorApp.noAutenticado('La cuenta ya no existe');

  const { telefono, ...cambios } = datos;
  if (telefono !== undefined) cambios.telefonoCifrado = telefono === null ? null : cifrar(telefono);

  if (datos.fotoPerfilId) await archivos.exigirArchivosPropios([datos.fotoPerfilId], usuarioId);

  await repositorio.actualizarPerfil(usuarioId, cambios);

  // La foto anterior ya no se usa: se borra del bucket (si falla, no afecta al usuario).
  const fotoAnterior = actual.foto_perfil_id;
  if (datos.fotoPerfilId !== undefined && fotoAnterior && fotoAnterior !== datos.fotoPerfilId) {
    archivos
      .eliminarArchivo(fotoAnterior, usuarioId)
      .catch((err) => logger.warn({ err }, 'No se pudo borrar la foto de perfil anterior'));
  }

  return obtenerYo(usuarioId);
}

// ── Administración ──────────────────────────────────

export const buscarRolYEstado = (usuarioId) => repositorio.buscarRolYEstado(usuarioId);

/** true solo si la cuenta existe, está activa y tiene rol admin. */
export async function esAdmin(usuarioId) {
  const fila = await repositorio.buscarRolYEstado(usuarioId);
  return fila?.rol === 'admin' && fila.estado === 'activo';
}

export const suspender = (usuarioId, datos) => repositorio.suspender(usuarioId, datos);
export const reactivar = (usuarioId) => repositorio.reactivar(usuarioId);

/** Moderación: quita la foto de perfil (y la borra del bucket). Devuelve true si tenía. */
export async function quitarFotoComoModerador(usuarioId) {
  const actual = await repositorio.buscarCuenta(usuarioId);
  if (!actual) throw ErrorApp.noEncontrado('Usuario no encontrado');
  if (!actual.foto_perfil_id) return false;
  await repositorio.actualizarPerfil(usuarioId, { fotoPerfilId: null });
  await archivos.eliminarArchivosSinDueno([actual.foto_perfil_id]);
  return true;
}
