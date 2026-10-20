/**
 * Eventos en tiempo real de publicaciones.
 * Al abrir una publicación, el cliente se une a su sala para recibir
 * comentarios y reacciones en vivo; al salir, la abandona.
 * Solo se entra a la sala si el usuario puede ver la publicación.
 */
import { logger } from '../../lib/logger.js';
import { EVENTOS } from '../../sockets/eventos.js';
import { salaPublicacion } from '../../sockets/emisor.js';
import { idPublicacion } from './publicaciones.esquemas.js';
import * as servicio from './publicaciones.servicio.js';

export function registrarSocketsPublicaciones(_io, socket) {
  socket.on(EVENTOS.PUBLICACION_UNIRSE, async (datos) => {
    const validado = idPublicacion.safeParse(datos);
    if (!validado.success) return;
    try {
      if (await servicio.puedeVer(validado.data, socket.data.usuario.id)) {
        socket.join(salaPublicacion(validado.data));
      }
    } catch (err) {
      logger.error({ err }, 'Error al unirse a la sala de una publicación');
    }
  });

  socket.on(EVENTOS.PUBLICACION_SALIR, (datos) => {
    const validado = idPublicacion.safeParse(datos);
    if (validado.success) socket.leave(salaPublicacion(validado.data));
  });
}
