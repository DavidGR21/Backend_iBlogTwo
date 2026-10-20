/**
 * Eventos en tiempo real de publicaciones.
 * Al abrir una publicación, el cliente se une a su sala para recibir
 * comentarios y reacciones en vivo; al salir, la abandona.
 */
import { EVENTOS } from '../../sockets/eventos.js';
import { salaPublicacion } from '../../sockets/emisor.js';

export function registrarSocketsPublicaciones(_io, socket) {
  socket.on(EVENTOS.PUBLICACION_UNIRSE, (publicacionId) => {
    // TODO: validar uuid y que el usuario pueda ver la publicación (visibilidad).
    socket.join(salaPublicacion(publicacionId));
  });

  socket.on(EVENTOS.PUBLICACION_SALIR, (publicacionId) => {
    socket.leave(salaPublicacion(publicacionId));
  });
}
