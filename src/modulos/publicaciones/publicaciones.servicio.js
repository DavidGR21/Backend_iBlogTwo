/**
 * Reglas de publicaciones:
 *  - Crear en transacción: publicaciones + publicacion_archivos (archivos propios y 'subido').
 *  - Editar puede reemplazar las imágenes (archivoIds = lista final, en orden): se vuelven a
 *    enlazar en una transacción y las que se quitaron se borran del bucket después.
 *  - Eliminar es lógico (eliminado_en), pero sus imágenes sí se borran del bucket.
 *    Un administrador puede eliminar publicaciones de cualquiera (eliminarComoModerador).
 *  - Visibilidad: 'publico' para todos, 'amigos' solo amigos (v_amigos), 'privado' solo el autor.
 *    Si no puedes verla, se responde 404 (no se revela que existe).
 *  - Reaccionar = INSERT … ON CONFLICT (publicacion_id, usuario_id) DO UPDATE SET tipo.
 *  - La lista de quién reaccionó respeta la misma visibilidad que la publicación.
 *  - Después de guardar, emitir el evento con sockets/emisor.js.
 *
 * Exporta también `exigirVisible(id, usuarioId)` y `puedeVer(id, usuarioId)` para
 * comentarios y para la sala de Socket.io.
 */
import { enTransaccion } from '../../db/transaccion.js';
import { ErrorApp } from '../../errores/ErrorApp.js';
import { urlParaVer } from '../../lib/almacenamiento.js';
import { codificarCursor, decodificarCursor, paginar } from '../../lib/paginacion.js';
import { EVENTOS } from '../../sockets/eventos.js';
import {
  emitirASala,
  emitirATodos,
  emitirAUsuario,
  salaPublicacion,
} from '../../sockets/emisor.js';
import * as amistades from '../amistades/amistades.servicio.js';
import * as archivos from '../archivos/archivos.servicio.js';
import * as usuarios from '../usuarios/usuarios.servicio.js';
import * as repositorio from './publicaciones.repositorio.js';
import { aPublicacion, aReaccion } from './publicaciones.mapeador.js';

const noEncontrada = () => ErrorApp.noEncontrado('Publicación no encontrada');

async function armar(fila) {
  const [autor, imagenes] = await Promise.all([
    usuarios.armarResumen(fila.autor),
    Promise.all(
      fila.imagenes.map(async (img) => ({ id: img.id, url: await urlParaVer(img.clave) })),
    ),
  ]);
  return aPublicacion(fila, { autor, imagenes });
}

const cursorDe = (fila) => codificarCursor([fila.cursor_fecha, fila.id]);

export async function listarFeed(visitanteId, { antesDe, limite }) {
  const filas = await repositorio.listarFeed({
    visitanteId,
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, cursorDe, armar);
}

export async function listarDeUsuario(autorId, visitanteId, { antesDe, limite }) {
  const filas = await repositorio.listarDeAutor({
    autorId,
    visitanteId,
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, cursorDe, armar);
}

export async function obtener(id, visitanteId) {
  const fila = await repositorio.buscarVisible(id, visitanteId);
  if (!fila) throw noEncontrada();
  return armar(fila);
}

export const puedeVer = (id, usuarioId) => repositorio.puedeVer(id, usuarioId);

export async function exigirVisible(id, usuarioId) {
  if (!(await repositorio.puedeVer(id, usuarioId))) throw noEncontrada();
}

/** Avisa en vivo: públicas a todos; las de "amigos", solo a los amigos del autor. */
async function anunciarNueva(publicacion) {
  if (publicacion.visibilidad === 'publico') {
    emitirATodos(EVENTOS.PUBLICACION_NUEVA, publicacion);
  } else if (publicacion.visibilidad === 'amigos') {
    const amigos = await amistades.listarIdsAmigos(publicacion.autor.id);
    for (const amigoId of amigos) emitirAUsuario(amigoId, EVENTOS.PUBLICACION_NUEVA, publicacion);
  }
}

/** Enlaza las imágenes en orden; 23505 = alguna ya está en otra publicación. */
async function enlazarSinRepetir(publicacionId, archivoIds, db) {
  try {
    await repositorio.enlazarArchivos(publicacionId, archivoIds, db);
  } catch (error) {
    if (error.code === '23505') {
      throw ErrorApp.conflicto('Alguna imagen ya pertenece a otra publicación');
    }
    throw error;
  }
}

export async function crear(autorId, { contenido, visibilidad, archivoIds }) {
  const { id } = await enTransaccion(async (db) => {
    await archivos.exigirArchivosPropios(archivoIds, autorId, db);
    const creada = await repositorio.crear({ autorId, contenido, visibilidad }, db);
    await enlazarSinRepetir(creada.id, archivoIds, db);
    return creada;
  });

  const publicacion = await obtener(id, autorId);
  await anunciarNueva(publicacion);
  return publicacion;
}

async function exigirAutor(id, usuarioId) {
  const fila = await repositorio.buscarBasica(id);
  if (!fila) throw noEncontrada();
  if (fila.autor_id !== usuarioId) throw ErrorApp.prohibido('Solo el autor puede hacer esto');
  return fila;
}

export async function editar(id, usuarioId, { contenido, visibilidad, archivoIds }) {
  await exigirAutor(id, usuarioId);

  const quitadas = await enTransaccion(async (db) => {
    // Siempre se actualiza la fila: así actualizado_en marca la publicación como editada
    await repositorio.actualizar(id, { contenido, visibilidad }, db);
    if (archivoIds === undefined) return [];

    const actuales = await repositorio.listarArchivoIds(id, db);
    await archivos.exigirArchivosPropios(archivoIds, usuarioId, db);
    await repositorio.desenlazarArchivos(id, db);
    await enlazarSinRepetir(id, archivoIds, db);
    return actuales.filter((archivoId) => !archivoIds.includes(archivoId));
  });

  // Fuera de la transacción: si el bucket falla, la publicación ya quedó bien guardada
  await archivos.eliminarArchivosSinDueno(quitadas);
  return obtener(id, usuarioId);
}

/**
 * Borrado lógico + sus imágenes fuera del bucket (ya nadie puede verlas).
 * Avisa a todos para que la quiten de las listas que tengan abiertas.
 */
async function borrar(id, eliminadoPor = null) {
  const archivoIds = await repositorio.listarArchivoIds(id);
  await repositorio.marcarEliminada(id, eliminadoPor);
  emitirATodos(EVENTOS.PUBLICACION_ELIMINADA, { publicacionId: id });
  await archivos.eliminarArchivosSinDueno(archivoIds);
}

export async function eliminar(id, usuarioId) {
  await exigirAutor(id, usuarioId);
  await borrar(id);
}

/** Moderación: borra la publicación de cualquier autor. Devuelve { id, autor_id }. */
export async function eliminarComoModerador(id, moderadorId) {
  const fila = await repositorio.buscarBasica(id);
  if (!fila) throw noEncontrada();
  await borrar(id, moderadorId);
  return fila;
}

/** Moderación: borra todas las publicaciones de un autor. Devuelve cuántas. */
export async function eliminarTodasDeAutor(autorId, moderadorId) {
  const ids = await repositorio.listarIdsDeAutor(autorId);
  for (const id of ids) await borrar(id, moderadorId);
  return ids.length;
}

/** Personas que reaccionaron (solo si el visitante puede ver la publicación). */
export async function listarReacciones(id, visitanteId, { tipo, antesDe, limite }) {
  await exigirVisible(id, visitanteId);
  const filas = await repositorio.listarReacciones({
    publicacionId: id,
    tipo,
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, cursorDe, async (fila) =>
    aReaccion(fila, { usuario: await usuarios.armarResumen(fila.usuario) }),
  );
}

async function responderReacciones(id, miReaccion) {
  const reacciones = await repositorio.contarReacciones(id);
  emitirASala(salaPublicacion(id), EVENTOS.REACCION_ACTUALIZADA, { publicacionId: id, reacciones });
  return { reacciones, miReaccion };
}

export async function reaccionar(id, usuarioId, tipo) {
  await exigirVisible(id, usuarioId);
  await repositorio.guardarReaccion(id, usuarioId, tipo);
  return responderReacciones(id, tipo);
}

export async function quitarReaccion(id, usuarioId) {
  await exigirVisible(id, usuarioId);
  await repositorio.borrarReaccion(id, usuarioId);
  return responderReacciones(id, null);
}
