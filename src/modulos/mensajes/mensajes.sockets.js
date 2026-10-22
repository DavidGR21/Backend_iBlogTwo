/**
 * Eventos en tiempo real del chat.
 *
 *  - EVENTOS.MENSAJE_ENVIAR { conversacionId, contenido?, archivoId?, stickerId? } con callback de confirmación:
 *      validar → servicio.enviarMensaje (que emite EVENTOS.MENSAJE_NUEVO a la sala
 *      personal de cada participante) → responder { ok: true, mensaje }.
 *  - EVENTOS.MENSAJE_LEIDO { conversacionId, mensajeId } → actualizar ultimo_leido_mensaje_id.
 *  - EVENTOS.CONVERSACION_ESCRIBIENDO { conversacionId } → reenviar a los demás (sin guardar).
 *
 * Patrón para cada evento:
 *   socket.on(EVENTOS.X, async (datos, responder) => {
 *     try { const r = await servicio.algo(socket.data.usuario.id, datos); responder?.({ ok: true, r }); }
 *     catch (err) { responder?.({ ok: false, error: err.codigo ?? 'ERROR_INTERNO' }); }
 *   });
 */
import { ErrorApp } from '../../errores/ErrorApp.js';
import { logger } from '../../lib/logger.js';
import { EVENTOS } from '../../sockets/eventos.js';
import { salaUsuario } from '../../sockets/emisor.js';
import {
  esquemaEnviarMensaje,
  esquemaEscribiendo,
  esquemaMensajeLeido,
} from './mensajes.esquemas.js';
import * as servicio from './mensajes.servicio.js';

const MAX_CONVERSACIONES_EN_CACHE = 50;

function validarDatos(esquema, datos) {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) throw ErrorApp.solicitudInvalida(resultado.error.issues[0]?.message);
  return resultado.data;
}

/** Convierte cualquier error en el ack { ok: false, error: 'CODIGO' }. */
function manejarError(err, evento, responder) {
  if (!(err instanceof ErrorApp)) logger.error({ err, evento }, 'Error en evento de socket');
  if (typeof responder === 'function') {
    responder({ ok: false, error: err instanceof ErrorApp ? err.codigo : 'ERROR_INTERNO' });
  }
}

export function registrarSocketsMensajes(_io, socket) {
  const usuarioId = socket.data.usuario.id;

  // "Escribiendo…" llega cada ~2 s: se recuerda a quién reenviarlo para no
  // consultar la BD cada vez. Vive lo que dure la conexión.
  const destinatariosPorConversacion = new Map();

  async function otrosParticipantes(conversacionId) {
    if (!destinatariosPorConversacion.has(conversacionId)) {
      const participantes = await servicio.exigirParticipante(conversacionId, usuarioId);
      if (destinatariosPorConversacion.size >= MAX_CONVERSACIONES_EN_CACHE) {
        destinatariosPorConversacion.clear();
      }
      destinatariosPorConversacion.set(
        conversacionId,
        participantes.filter((id) => id !== usuarioId),
      );
    }
    return destinatariosPorConversacion.get(conversacionId);
  }

  socket.on(EVENTOS.MENSAJE_ENVIAR, async (datos, responder) => {
    try {
      const mensaje = await servicio.enviarMensaje(
        usuarioId,
        validarDatos(esquemaEnviarMensaje, datos),
      );
      if (typeof responder === 'function') responder({ ok: true, mensaje });
    } catch (err) {
      manejarError(err, EVENTOS.MENSAJE_ENVIAR, responder);
    }
  });

  socket.on(EVENTOS.MENSAJE_LEIDO, async (datos, responder) => {
    try {
      await servicio.marcarLeido(usuarioId, validarDatos(esquemaMensajeLeido, datos));
      if (typeof responder === 'function') responder({ ok: true });
    } catch (err) {
      manejarError(err, EVENTOS.MENSAJE_LEIDO, responder);
    }
  });

  socket.on(EVENTOS.CONVERSACION_ESCRIBIENDO, async (datos) => {
    try {
      const { conversacionId } = validarDatos(esquemaEscribiendo, datos);
      const otros = await otrosParticipantes(conversacionId);
      if (otros.length === 0) return;
      socket
        .to(otros.map(salaUsuario))
        .emit(EVENTOS.CONVERSACION_ESCRIBIENDO, { conversacionId, usuarioId });
    } catch (err) {
      manejarError(err, EVENTOS.CONVERSACION_ESCRIBIENDO);
    }
  });
}
