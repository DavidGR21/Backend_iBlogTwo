/**
 * Eventos en tiempo real del chat.
 *
 * Pendiente:
 *  - EVENTOS.MENSAJE_ENVIAR { conversacionId, contenido?, archivoId? } con callback de confirmación:
 *      validar → servicio.enviarMensaje → emitir EVENTOS.MENSAJE_NUEVO a salaConversacion
 *      y a salaUsuario de cada participante (para la bandeja de entrada).
 *  - EVENTOS.MENSAJE_LEIDO { conversacionId, mensajeId } → actualizar ultimo_leido_mensaje_id.
 *  - EVENTOS.CONVERSACION_ESCRIBIENDO { conversacionId } → reenviar a los demás (sin guardar).
 *
 * Patrón para cada evento:
 *   socket.on(EVENTOS.X, async (datos, responder) => {
 *     try { const r = await servicio.algo(socket.data.usuario.id, datos); responder?.({ ok: true, r }); }
 *     catch (err) { responder?.({ ok: false, error: err.codigo ?? 'ERROR_INTERNO' }); }
 *   });
 */
export function registrarSocketsMensajes(_io, _socket) {}
