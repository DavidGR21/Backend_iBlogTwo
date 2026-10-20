/**
 * Tokens de la aplicación.
 *
 * - Token de acceso (JWT, corto): viaja en el header Authorization y en el
 *   handshake de Socket.io. Identifica al usuario.
 * - Tokens aleatorios (refresh, verificación de correo, recuperar clave):
 *   al usuario se le entrega el token en claro; en la BD solo se guarda su SHA-256.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const DURACION_TOKEN_ACCESO = '15m';

export function firmarTokenAcceso(usuarioId) {
  return jwt.sign({}, env.JWT_SECRETO, {
    subject: usuarioId,
    expiresIn: DURACION_TOKEN_ACCESO,
    algorithm: 'HS256',
  });
}

/** Devuelve { id } o lanza un error si el token es inválido o expiró. */
export function verificarTokenAcceso(token) {
  const contenido = jwt.verify(token, env.JWT_SECRETO, { algorithms: ['HS256'] });
  return { id: contenido.sub };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest();
}

export function generarTokenAleatorio(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}
