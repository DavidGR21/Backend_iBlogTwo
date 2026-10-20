/**
 * Reglas de mensajería:
 *  - Solo se puede abrir un chat con un amigo (amistades.servicio → sonAmigos).
 *    Si dejan de ser amigos, el historial se puede leer pero ya no se puede escribir.
 *  - clave_directa = '<uuid menor>:<uuid mayor>' evita chats duplicados.
 *  - El contenido se guarda con lib/cifrado (cifrar) y se devuelve descifrado.
 *  - Solo los participantes pueden leer o enviar (la BD también lo exige).
 */
import { enTransaccion } from '../../db/transaccion.js';
import { ErrorApp } from '../../errores/ErrorApp.js';
import { urlParaVer } from '../../lib/almacenamiento.js';
import { cifrar } from '../../lib/cifrado.js';
import { paginar } from '../../lib/paginacion.js';
import { EVENTOS } from '../../sockets/eventos.js';
import { emitirAUsuario } from '../../sockets/emisor.js';
import * as amistades from '../amistades/amistades.servicio.js';
import * as archivos from '../archivos/archivos.servicio.js';
import * as usuarios from '../usuarios/usuarios.servicio.js';
import * as repositorio from './mensajes.repositorio.js';
import { aConversacion, aMensaje } from './mensajes.mapeador.js';

const noEncontrada = () => ErrorApp.noEncontrado('Conversación no encontrada');

async function armarConversacion(fila) {
  return aConversacion(fila, { otroUsuario: await usuarios.armarResumen(fila.otro_usuario) });
}

async function armarMensaje(fila) {
  return aMensaje(fila, {
    imagenUrl: fila.imagen_clave ? await urlParaVer(fila.imagen_clave) : null,
  });
}

export async function listarConversaciones(usuarioId) {
  const filas = await repositorio.listarDeUsuario(usuarioId);
  return { items: await Promise.all(filas.map(armarConversacion)) };
}

export async function abrirConversacion(usuarioId, amigoId) {
  if (usuarioId === amigoId) throw ErrorApp.solicitudInvalida('No puedes escribirte a ti mismo');
  if (!(await amistades.sonAmigos(usuarioId, amigoId))) {
    throw ErrorApp.prohibido('Solo puedes escribirle a tus amigos');
  }

  const claveDirecta = [usuarioId, amigoId].sort().join(':');
  const id = await enTransaccion((db) =>
    repositorio.obtenerOCrearDirecta(claveDirecta, [usuarioId, amigoId], db),
  );

  const fila = await repositorio.buscarDeUsuario(id, usuarioId);
  if (!fila) throw ErrorApp.noEncontrado('Usuario no encontrado');
  return armarConversacion(fila);
}

/** Devuelve los ids de los participantes o lanza 404 si el usuario no es uno de ellos. */
export async function exigirParticipante(conversacionId, usuarioId) {
  const participantes = await repositorio.listarParticipantes(conversacionId, usuarioId);
  if (participantes.length === 0) throw noEncontrada();
  return participantes;
}

export async function listarMensajes(conversacionId, usuarioId, { antesDe, limite }) {
  await exigirParticipante(conversacionId, usuarioId);
  const filas = await repositorio.listarMensajes({ conversacionId, antesDe, limite: limite + 1 });
  return paginar(filas, limite, (f) => Number(f.id), armarMensaje);
}

export async function enviarMensaje(remitenteId, { conversacionId, contenido, archivoId }) {
  const participantes = await exigirParticipante(conversacionId, remitenteId);
  const otros = participantes.filter((id) => id !== remitenteId);

  const siguenSiendoAmigos = await Promise.all(
    otros.map((id) => amistades.sonAmigos(remitenteId, id)),
  );
  if (!siguenSiendoAmigos.every(Boolean)) {
    throw ErrorApp.prohibido('Ya no son amigos: no puedes enviar mensajes en este chat');
  }

  if (archivoId) await archivos.exigirArchivosPropios([archivoId], remitenteId);

  const id = await repositorio.crearMensaje({
    conversacionId,
    remitenteId,
    contenidoCifrado: contenido ? cifrar(contenido) : null,
    archivoId,
  });
  const mensaje = await armarMensaje(await repositorio.buscarMensaje(id));

  // A la sala personal de cada participante (también al remitente: sus otras pestañas).
  for (const participanteId of participantes) {
    emitirAUsuario(participanteId, EVENTOS.MENSAJE_NUEVO, mensaje);
  }
  return mensaje;
}

export async function marcarLeido(usuarioId, { conversacionId, mensajeId }) {
  await repositorio.marcarLeido(conversacionId, usuarioId, mensajeId);
}
