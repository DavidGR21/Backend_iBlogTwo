/**
 * Reglas de publicaciones:
 *  - Crear en transacción: publicaciones + publicacion_archivos (archivos propios y 'subido').
 *  - Visibilidad: 'publico' para todos, 'amigos' solo amigos (v_amigos), 'privado' solo el autor.
 *    Si no puedes verla, se responde 404 (no se revela que existe).
 *  - Reaccionar = INSERT … ON CONFLICT (publicacion_id, usuario_id) DO UPDATE SET tipo.
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
import { aPublicacion } from './publicaciones.mapeador.js';

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

export async function crear(autorId, { contenido, visibilidad, archivoIds }) {
  const { id } = await enTransaccion(async (db) => {
    await archivos.exigirArchivosPropios(archivoIds, autorId, db);
    const creada = await repositorio.crear({ autorId, contenido, visibilidad }, db);
    try {
      await repositorio.enlazarArchivos(creada.id, archivoIds, db);
    } catch (error) {
      if (error.code === '23505') {
        throw ErrorApp.conflicto('Alguna imagen ya pertenece a otra publicación');
      }
      throw error;
    }
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

export async function editar(id, usuarioId, cambios) {
  await exigirAutor(id, usuarioId);
  await repositorio.actualizar(id, cambios);
  return obtener(id, usuarioId);
}

export async function eliminar(id, usuarioId) {
  await exigirAutor(id, usuarioId);
  await repositorio.marcarEliminada(id);
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
