/**
 * Middleware de Socket.io: solo se conectan usuarios con token válido.
 * El frontend se conecta así:
 *   io(URL_BACKEND, { auth: { token: tokenDeAcceso } })
 */
import { verificarTokenAcceso } from '../lib/tokens.js';

export function autenticarSocket(socket, next) {
  try {
    socket.data.usuario = verificarTokenAcceso(socket.handshake.auth?.token);
    next();
  } catch {
    next(new Error('NO_AUTENTICADO'));
  }
}
