/**
 * Permite que los SERVICIOS emitan eventos en tiempo real sin conocer Socket.io.
 *
 *   // en comentarios.servicio.js, después de guardar el comentario:
 *   emitirASala(salaPublicacion(publicacionId), EVENTOS.COMENTARIO_NUEVO, comentario);
 *
 * Salas usadas:
 *   usuario:<id>       → cada usuario conectado (notificaciones personales)
 *   publicacion:<id>   → quienes están viendo esa publicación
 *   conversacion:<id>  → participantes de un chat
 */
let io = null;

export function establecerIo(instancia) {
  io = instancia;
}

export const salaUsuario = (id) => `usuario:${id}`;
export const salaPublicacion = (id) => `publicacion:${id}`;
export const salaConversacion = (id) => `conversacion:${id}`;

export function emitirAUsuario(usuarioId, evento, datos) {
  io?.to(salaUsuario(usuarioId)).emit(evento, datos);
}

export function emitirASala(sala, evento, datos) {
  io?.to(sala).emit(evento, datos);
}

/** A todos los usuarios conectados (p. ej. una publicación pública nueva). */
export function emitirATodos(evento, datos) {
  io?.emit(evento, datos);
}
