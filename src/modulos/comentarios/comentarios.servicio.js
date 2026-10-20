/**
 * Reglas de comentarios:
 *  - Solo se comenta lo que el usuario puede ver (misma regla de visibilidad que publicaciones).
 *  - Solo se responde a comentarios no eliminados de la misma publicación
 *    (la BD también garantiza que la respuesta sea del mismo post que su padre).
 *  - Un comentario borrado con respuestas se muestra como "Comentario eliminado".
 *  - Edita solo el autor; elimina el autor del comentario o el de la publicación.
 */
import { ErrorApp } from '../../errores/ErrorApp.js';
import { codificarCursor, decodificarCursor, paginar } from '../../lib/paginacion.js';
import { EVENTOS } from '../../sockets/eventos.js';
import { emitirASala, salaPublicacion } from '../../sockets/emisor.js';
import * as publicaciones from '../publicaciones/publicaciones.servicio.js';
import * as usuarios from '../usuarios/usuarios.servicio.js';
import * as repositorio from './comentarios.repositorio.js';
import { aComentario } from './comentarios.mapeador.js';

const noEncontrado = () => ErrorApp.noEncontrado('Comentario no encontrado');

async function armar(fila) {
  return aComentario(fila, { autor: await usuarios.armarResumen(fila.autor) });
}

export async function listarDePublicacion(visitanteId, { publicacionId, antesDe, limite }) {
  await publicaciones.exigirVisible(publicacionId, visitanteId);
  const filas = await repositorio.listarRaiz({
    publicacionId,
    cursor: decodificarCursor(antesDe),
    limite: limite + 1,
  });
  return paginar(filas, limite, (f) => codificarCursor([f.cursor_fecha, f.id]), armar);
}

export async function listarRespuestas(comentarioId, visitanteId) {
  const padre = await repositorio.buscarBasico(comentarioId);
  if (!padre) throw noEncontrado();
  await publicaciones.exigirVisible(padre.publicacion_id, visitanteId);

  const filas = await repositorio.listarRespuestas(comentarioId);
  return { items: await Promise.all(filas.map(armar)) };
}

export async function crear(autorId, { publicacionId, contenido, comentarioPadreId }) {
  await publicaciones.exigirVisible(publicacionId, autorId);

  if (comentarioPadreId) {
    const padre = await repositorio.buscarBasico(comentarioPadreId);
    if (!padre || padre.publicacion_id !== publicacionId) {
      throw ErrorApp.solicitudInvalida('El comentario al que respondes no existe');
    }
    if (padre.eliminado_en) {
      throw ErrorApp.solicitudInvalida('No puedes responder a un comentario eliminado');
    }
  }

  const { id } = await repositorio.crear({ publicacionId, autorId, contenido, comentarioPadreId });
  const comentario = await armar(await repositorio.buscarPorId(id));

  emitirASala(salaPublicacion(publicacionId), EVENTOS.COMENTARIO_NUEVO, comentario);
  return comentario;
}

async function buscarVigente(id, usuarioId) {
  const fila = await repositorio.buscarBasico(id);
  if (!fila || fila.eliminado_en) throw noEncontrado();
  await publicaciones.exigirVisible(fila.publicacion_id, usuarioId);
  return fila;
}

export async function editar(id, usuarioId, contenido) {
  const fila = await buscarVigente(id, usuarioId);
  if (fila.autor_id !== usuarioId) throw ErrorApp.prohibido('Solo puedes editar tus comentarios');

  await repositorio.actualizar(id, contenido);
  return armar(await repositorio.buscarPorId(id));
}

export async function eliminar(id, usuarioId) {
  const fila = await buscarVigente(id, usuarioId);
  if (fila.autor_id !== usuarioId && fila.autor_publicacion_id !== usuarioId) {
    throw ErrorApp.prohibido('No puedes eliminar este comentario');
  }
  await repositorio.marcarEliminado(id);
}
