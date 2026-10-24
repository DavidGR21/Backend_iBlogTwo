/**
 * Middleware de Socket.io: solo se conectan usuarios con token válido
 * (y cuya cuenta no acabe de ser suspendida).
 * El frontend se conecta así:
 *   io(URL_BACKEND, { auth: { token: tokenDeAcceso } })
 */
import { estaSuspendido } from '../lib/suspendidos.js';
import { verificarTokenAcceso } from '../lib/tokens.js';

export function autenticarSocket(socket, next) {
  try {
    const usuario = verificarTokenAcceso(socket.handshake.auth?.token);
    if (estaSuspendido(usuario.id)) throw new Error('Cuenta suspendida');
    socket.data.usuario = usuario;
    next();
  } catch {
    next(new Error('NO_AUTENTICADO'));
  }
}
