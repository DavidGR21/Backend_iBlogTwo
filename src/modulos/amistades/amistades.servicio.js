/**
 * Reglas de amistades:
 *  - No puedes enviarte una solicitud a ti mismo (también lo impide la BD).
 *  - Si ya existe una fila para el par (en cualquier dirección), responder conflicto.
 *  - Solo el destinatario acepta; cualquiera de los dos puede borrar la fila
 *    (rechazar, cancelar o eliminar amigo).
 *  - Exporta `sonAmigos(a, b)`, `listarIdsAmigos(id)` y `obtenerRelacion(yo, otro)`:
 *    los usan publicaciones (visibilidad), mensajes y el perfil público.
 */
import { ErrorApp } from '../../errores/ErrorApp.js';
import { EVENTOS } from '../../sockets/eventos.js';
import { emitirAUsuario } from '../../sockets/emisor.js';
import * as usuarios from '../usuarios/usuarios.servicio.js';
import * as repositorio from './amistades.repositorio.js';
import { aAmigo, aRelacion, aSolicitud } from './amistades.mapeador.js';

export const sonAmigos = (usuarioA, usuarioB) => repositorio.sonAmigos(usuarioA, usuarioB);
export const listarIdsAmigos = (usuarioId) => repositorio.listarIdsAmigos(usuarioId);

export async function obtenerRelacion(usuarioId, otroId) {
  const fila = await repositorio.buscarEntre(usuarioId, otroId);
  return fila ? aRelacion(fila, usuarioId) : null;
}

export async function listarAmigos(usuarioId) {
  const filas = await repositorio.listarAmigos(usuarioId);
  const items = await Promise.all(
    filas.map(async (f) => aAmigo(f, await usuarios.armarResumen(f.usuario))),
  );
  return { items };
}

export async function listarSolicitudes(usuarioId, tipo) {
  const filas =
    tipo === 'enviadas'
      ? await repositorio.listarSolicitudesEnviadas(usuarioId)
      : await repositorio.listarSolicitudesRecibidas(usuarioId);
  const items = await Promise.all(
    filas.map(async (f) => aSolicitud(f, await usuarios.armarResumen(f.usuario))),
  );
  return { items };
}

export async function enviarSolicitud(solicitanteId, destinatarioId) {
  if (solicitanteId === destinatarioId) {
    throw ErrorApp.solicitudInvalida('No puedes enviarte una solicitud a ti mismo');
  }

  const [destinatario, solicitante] = await Promise.all([
    usuarios.obtenerResumen(destinatarioId),
    usuarios.obtenerResumen(solicitanteId),
  ]);
  if (!destinatario) throw ErrorApp.noEncontrado('Usuario no encontrado');

  const existente = await repositorio.buscarEntre(solicitanteId, destinatarioId);
  if (existente) throw conflictoPorExistente(existente, solicitanteId);

  let fila;
  try {
    fila = await repositorio.crearSolicitud(solicitanteId, destinatarioId);
  } catch (error) {
    // Dos solicitudes cruzadas al mismo tiempo: el índice único del par lo impide.
    if (error.code === '23505') throw ErrorApp.conflicto('Ya existe una solicitud entre ustedes');
    throw error;
  }

  // Al destinatario le llega quién la envía; a quien la envía, a quién se la envió.
  emitirAUsuario(destinatarioId, EVENTOS.AMISTAD_SOLICITUD, aSolicitud(fila, solicitante));
  return aSolicitud(fila, destinatario);
}

function conflictoPorExistente(fila, solicitanteId) {
  if (fila.estado === 'aceptada') return ErrorApp.conflicto('Ya son amigos');
  if (fila.solicitante_id === solicitanteId) {
    return ErrorApp.conflicto('Ya le enviaste una solicitud a este usuario');
  }
  return ErrorApp.conflicto('Este usuario ya te envió una solicitud: acéptala desde "Amigos"');
}

export async function aceptarSolicitud(id, usuarioId) {
  const fila = await repositorio.aceptar(id, usuarioId);
  if (!fila) {
    const existente = await repositorio.buscarPorId(id);
    if (existente?.destinatario_id === usuarioId && existente.estado === 'aceptada') {
      throw ErrorApp.conflicto('Ya aceptaste esta solicitud');
    }
    throw ErrorApp.noEncontrado('Solicitud no encontrada');
  }

  const [solicitante, aceptante] = await Promise.all([
    usuarios.obtenerResumen(fila.solicitante_id),
    usuarios.obtenerResumen(usuarioId),
  ]);

  emitirAUsuario(fila.solicitante_id, EVENTOS.AMISTAD_ACEPTADA, aAmigo(fila, aceptante));
  return aAmigo(fila, solicitante);
}

export async function eliminar(id, usuarioId) {
  const fila = await repositorio.eliminar(id, usuarioId);
  if (!fila) throw ErrorApp.noEncontrado('Amistad o solicitud no encontrada');
}
