/**
 * Crea el servidor de Socket.io y registra los manejadores de cada módulo.
 * La lógica de cada evento vive en src/modulos/<modulo>/<modulo>.sockets.js.
 */
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { autenticarSocket } from './autenticarSocket.js';
import { establecerIo, salaUsuario } from './emisor.js';
import { registrarSocketsPublicaciones } from '../modulos/publicaciones/publicaciones.sockets.js';
import { registrarSocketsMensajes } from '../modulos/mensajes/mensajes.sockets.js';

export function crearServidorSockets(servidorHttp) {
  const io = new Server(servidorHttp, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  io.use(autenticarSocket);

  io.on('connection', (socket) => {
    const { id } = socket.data.usuario;
    socket.join(salaUsuario(id));
    logger.info({ usuarioId: id }, 'Socket conectado');

    registrarSocketsPublicaciones(io, socket);
    registrarSocketsMensajes(io, socket);

    socket.on('disconnect', () => logger.info({ usuarioId: id }, 'Socket desconectado'));
  });

  establecerIo(io);
  return io;
}
