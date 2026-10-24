/**
 * Reglas del panel de administración (todas las rutas ya pasaron por exigirAdmin):
 *  - Un admin no puede suspenderse a sí mismo ni suspender, borrar el contenido o quitar
 *    la foto de otro admin (los roles solo se cambian desde la terminal: npm run admin).
 *  - Suspender = estado 'suspendido' + revocar sus sesiones + cortar su token de acceso
 *    vigente (lib/suspendidos) y sus sockets. Su contenido desaparece de la web porque
 *    v_usuarios_resumen solo muestra cuentas activas; con `borrarContenido` además se
 *    borran sus publicaciones (y sus imágenes del bucket) y comentarios.
 *  - Borrar publicaciones y comentarios usa los servicios de esos módulos
 *    (eliminarComoModerador), que también limpian el bucket.
 *  - Toda acción queda en acciones_admin (registro de auditoría).
 */
import { ErrorApp } from '../../errores/ErrorApp.js';
import { urlParaVer } from '../../lib/almacenamiento.js';
import { hmac, normalizarCorreo } from '../../lib/cifrado.js';
import { codificarCursor, decodificarCursor, paginar } from '../../lib/paginacion.js';
import { marcarSuspendido, quitarSuspendido } from '../../lib/suspendidos.js';
import { desconectarUsuario } from '../../sockets/emisor.js';
import * as archivos from '../archivos/archivos.servicio.js';
import * as auth from '../auth/auth.servicio.js';
import * as comentarios from '../comentarios/comentarios.servicio.js';
import * as publicaciones from '../publicaciones/publicaciones.servicio.js';
import { leerSticker } from '../stickers/stickers.contenido.js';
import * as usuarios from '../usuarios/usuarios.servicio.js';
import * as repositorio from './admin.repositorio.js';
import {
  aAccion,
  aComentarioAdmin,
  aEstadisticas,
  aPublicacionAdmin,
  aUsuarioAdmin,
  aUsuarioAdminDetalle,
} from './admin.mapeador.js';

const DIAS_ACTIVIDAD = 14;
const MAS_ACTIVOS = 5;

const cursorDe = (fila) => codificarCursor([fila.cursor_fecha, fila.id]);
const urlFoto = (clave) => (clave ? urlParaVer(clave) : null);

/** "ana_1" → '%ana\_1%' (los comodines escritos por el admin se buscan literalmente). */
const patronBusqueda = (texto) => (texto ? `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null);

/** Autor de los listados: UsuarioResumen + estado de la cuenta. */
async function armarAutor(autor) {
  return { ...(await usuarios.armarResumen(autor)), estado: autor.estado };
}

const registrar = (adminId, accion, objetivoTipo, objetivoId, detalle) =>
  repositorio.registrarAccion({ adminId, accion, objetivoTipo, objetivoId, detalle });

// ── Estadísticas ────────────────────────────────────

export async function obtenerEstadisticas() {
  const [conteos, actividad, masActivos] = await Promise.all([
    repositorio.contarTodo(),
    repositorio.actividadPorDia(DIAS_ACTIVIDAD),
    repositorio.listarMasActivos(MAS_ACTIVOS),
  ]);
  const activos = await Promise.all(
    masActivos.map(async (fila) => ({
      usuario: await armarAutor(fila.usuario),
      publicaciones: fila.publicaciones,
    })),
  );
  return aEstadisticas(conteos, actividad, activos);
}

// ── Usuarios ────────────────────────────────────────

export async function listarUsuarios({ buscar, filtro, antesDe, limite }) {
  const texto = buscar?.replace(/^@/, '');
  const filas = await repositorio.listarUsuarios({
    patron: patronBusqueda(texto),
    correoHash: texto?.includes('@') ? hmac(normalizarCorreo(texto)) : null,
    filtro,
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, cursorDe, async (fila) =>
    aUsuarioAdmin(fila, { fotoPerfilUrl: await urlFoto(fila.foto_perfil_clave) }),
  );
}

export async function obtenerUsuario(id) {
  const fila = await repositorio.buscarUsuario(id);
  if (!fila) throw ErrorApp.noEncontrado('Usuario no encontrado');
  return aUsuarioAdminDetalle(fila, { fotoPerfilUrl: await urlFoto(fila.foto_perfil_clave) });
}

/** La cuenta objetivo debe existir y no ser otro administrador (ni uno mismo). */
async function exigirModerable(id, adminId) {
  if (id === adminId) throw ErrorApp.solicitudInvalida('No puedes hacer esto con tu propia cuenta');
  const cuenta = await usuarios.buscarRolYEstado(id);
  if (!cuenta) throw ErrorApp.noEncontrado('Usuario no encontrado');
  if (cuenta.rol === 'admin') {
    throw ErrorApp.prohibido('No puedes moderar a otro administrador');
  }
  return cuenta;
}

async function borrarContenidoDe(usuarioId, adminId) {
  const totalPublicaciones = await publicaciones.eliminarTodasDeAutor(usuarioId, adminId);
  const totalComentarios = await comentarios.eliminarTodosDeAutor(usuarioId, adminId);
  return { publicaciones: totalPublicaciones, comentarios: totalComentarios };
}

const resumenBorrado = ({ publicaciones: p, comentarios: c }) =>
  `${p} publicación(es) y ${c} comentario(s)`;

export async function suspender(id, adminId, { motivo, borrarContenido }) {
  const cuenta = await exigirModerable(id, adminId);
  if (cuenta.estado === 'suspendido') throw ErrorApp.conflicto('La cuenta ya está suspendida');

  await usuarios.suspender(id, { moderadorId: adminId, motivo });
  await auth.revocarSesiones(id);
  marcarSuspendido(id);
  desconectarUsuario(id);

  const nombre = await repositorio.buscarNombreUsuario(id);
  let detalle = `@${nombre}${motivo ? ` · Motivo: ${motivo}` : ''}`;
  if (borrarContenido)
    detalle += ` · Borrado: ${resumenBorrado(await borrarContenidoDe(id, adminId))}`;
  await registrar(adminId, 'suspender_usuario', 'usuario', id, detalle);

  return obtenerUsuario(id);
}

export async function reactivar(id, adminId) {
  const cuenta = await usuarios.buscarRolYEstado(id);
  if (!cuenta) throw ErrorApp.noEncontrado('Usuario no encontrado');
  if (cuenta.estado !== 'suspendido') throw ErrorApp.conflicto('La cuenta no está suspendida');

  await usuarios.reactivar(id);
  quitarSuspendido(id);
  await registrar(
    adminId,
    'reactivar_usuario',
    'usuario',
    id,
    `@${await repositorio.buscarNombreUsuario(id)}`,
  );
  return obtenerUsuario(id);
}

export async function verificarCorreo(id, adminId) {
  const actual = await obtenerUsuario(id);
  if (actual.correoVerificado) throw ErrorApp.conflicto('El correo ya está verificado');
  await auth.verificarCorreoManual(id);
  await registrar(adminId, 'verificar_correo', 'usuario', id, `@${actual.nombreUsuario}`);
  return obtenerUsuario(id);
}

/** Cierra todas sus sesiones: tendrá que volver a ingresar (útil si le robaron la cuenta). */
export async function cerrarSesiones(id, adminId) {
  const actual = await obtenerUsuario(id);
  await auth.revocarSesiones(id);
  desconectarUsuario(id);
  await registrar(adminId, 'cerrar_sesiones', 'usuario', id, `@${actual.nombreUsuario}`);
  return obtenerUsuario(id);
}

export async function quitarFoto(id, adminId) {
  await exigirModerable(id, adminId);
  if (!(await usuarios.quitarFotoComoModerador(id))) {
    throw ErrorApp.solicitudInvalida('El usuario no tiene foto de perfil');
  }
  await registrar(
    adminId,
    'quitar_foto',
    'usuario',
    id,
    `@${await repositorio.buscarNombreUsuario(id)}`,
  );
  return obtenerUsuario(id);
}

export async function borrarContenido(id, adminId) {
  await exigirModerable(id, adminId);
  const borrado = await borrarContenidoDe(id, adminId);
  await registrar(
    adminId,
    'borrar_contenido',
    'usuario',
    id,
    `@${await repositorio.buscarNombreUsuario(id)} · ${resumenBorrado(borrado)}`,
  );
  return borrado;
}

// ── Publicaciones y comentarios ─────────────────────

export async function listarPublicaciones({ buscar, autorId, estado, antesDe, limite }) {
  const filas = await repositorio.listarPublicaciones({
    patron: patronBusqueda(buscar),
    autorId,
    estado,
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, cursorDe, async (fila) => {
    const [autor, imagenes] = await Promise.all([
      armarAutor(fila.autor),
      Promise.all(
        fila.imagenes.map(async (img) => ({ id: img.id, url: await urlParaVer(img.clave) })),
      ),
    ]);
    return aPublicacionAdmin(fila, { autor, imagenes });
  });
}

export async function eliminarPublicacion(id, adminId) {
  const fila = await publicaciones.eliminarComoModerador(id, adminId);
  const autor = await repositorio.buscarNombreUsuario(fila.autor_id);
  await registrar(adminId, 'eliminar_publicacion', 'publicacion', id, `Autor: @${autor}`);
}

export async function listarComentarios({ buscar, autorId, estado, antesDe, limite }) {
  const filas = await repositorio.listarComentarios({
    patron: patronBusqueda(buscar),
    autorId,
    estado,
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, cursorDe, async (fila) =>
    aComentarioAdmin(fila, { autor: await armarAutor(fila.autor) }),
  );
}

export async function eliminarComentario(id, adminId) {
  const fila = await comentarios.eliminarComoModerador(id, adminId);
  const autor = await repositorio.buscarNombreUsuario(fila.autor_id);
  const texto = leerSticker(fila.contenido)
    ? '(sticker)'
    : fila.contenido.length > 80
      ? `${fila.contenido.slice(0, 80)}…`
      : fila.contenido;
  await registrar(adminId, 'eliminar_comentario', 'comentario', id, `@${autor}: ${texto}`);
}

// ── Registro y mantenimiento ────────────────────────

export async function listarRegistro({ antesDe, limite }) {
  const filas = await repositorio.listarAcciones({
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, cursorDe, aAccion);
}

/** Lanza ya la limpieza del bucket que server.js hace cada hora. */
export async function limpiarArchivos(adminId) {
  const resultado = await archivos.limpiarHuerfanos();
  await registrar(
    adminId,
    'limpiar_archivos',
    'sistema',
    null,
    `${resultado.pendientes} subida(s) sin confirmar y ${resultado.sinUso} imagen(es) sin uso`,
  );
  return resultado;
}
