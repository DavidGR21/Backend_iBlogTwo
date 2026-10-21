/**
 * Tokens de la aplicación.
 *
 * - Token de acceso (JWT, corto): viaja en el header Authorization y en el
 *   handshake de Socket.io. Identifica al usuario.
 * - Token de sesión (JWT, 1 día): el frontend lo guarda para recuperar la sesión
 *   al reabrir el navegador aunque la cookie del refresh token no llegue. No se
 *   guarda en la BD; lleva una huella de la clave para invalidarse si esta cambia.
 * - Tokens aleatorios (refresh, verificación de correo, recuperar clave):
 *   al usuario se le entrega el token en claro; en la BD solo se guarda su SHA-256.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const DURACION_TOKEN_ACCESO = '15m';
const HORAS_TOKEN_SESION = 24;

// La audiencia separa los dos JWT: un token de sesión no sirve como token de acceso.
const AUDIENCIA_ACCESO = 'acceso';
const AUDIENCIA_SESION = 'sesion';

export function firmarTokenAcceso(usuarioId) {
  return jwt.sign({}, env.JWT_SECRETO, {
    subject: usuarioId,
    audience: AUDIENCIA_ACCESO,
    expiresIn: DURACION_TOKEN_ACCESO,
    algorithm: 'HS256',
  });
}

/** Devuelve { id } o lanza un error si el token es inválido o expiró. */
export function verificarTokenAcceso(token) {
  const contenido = jwt.verify(token, env.JWT_SECRETO, {
    algorithms: ['HS256'],
    audience: AUDIENCIA_ACCESO,
  });
  return { id: contenido.sub };
}

/** Huella corta de la clave: si el usuario cambia su clave, los tokens de sesión dejan de valer. */
export function huellaClave(claveHash) {
  return crypto.createHash('sha256').update(claveHash).digest('base64url').slice(0, 16);
}

/** Devuelve { token, expiraEn } con expiraEn en ISO. */
export function firmarTokenSesion(usuarioId, claveHash) {
  const token = jwt.sign({ huella: huellaClave(claveHash) }, env.JWT_SECRETO, {
    subject: usuarioId,
    audience: AUDIENCIA_SESION,
    expiresIn: `${HORAS_TOKEN_SESION}h`,
    algorithm: 'HS256',
  });
  const { exp } = jwt.decode(token);
  return { token, expiraEn: new Date(exp * 1000).toISOString() };
}

/** Devuelve { id, huella } o lanza un error si el token es inválido o expiró. */
export function verificarTokenSesion(token) {
  const contenido = jwt.verify(token, env.JWT_SECRETO, {
    algorithms: ['HS256'],
    audience: AUDIENCIA_SESION,
  });
  return { id: contenido.sub, huella: contenido.huella };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest();
}

export function generarTokenAleatorio(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}
