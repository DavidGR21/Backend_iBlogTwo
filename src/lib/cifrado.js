/**
 * Cifrado de datos personales en reposo (correo, teléfono, mensajes).
 *
 * - cifrar/descifrar: AES-256-GCM. El resultado (bytea en la BD) es
 *   iv (12 bytes) || tag (16 bytes) || texto cifrado.
 * - hmac: huella determinista para buscar sin descifrar ("índice ciego"),
 *   p. ej. usuarios.correo_hash para el login y la unicidad del correo.
 *
 * Las contraseñas NO pasan por aquí: van en lib/clave.js (Argon2id).
 */
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITMO = 'aes-256-gcm';
const BYTES_IV = 12;
const BYTES_TAG = 16;

const llaveCifrado = Buffer.from(env.CLAVE_CIFRADO, 'base64');
const llaveHmac = Buffer.from(env.CLAVE_HMAC, 'base64');

export function cifrar(texto) {
  const iv = crypto.randomBytes(BYTES_IV);
  const cifrador = crypto.createCipheriv(ALGORITMO, llaveCifrado, iv);
  const cifrado = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return Buffer.concat([iv, cifrador.getAuthTag(), cifrado]);
}

export function descifrar(datos) {
  const iv = datos.subarray(0, BYTES_IV);
  const tag = datos.subarray(BYTES_IV, BYTES_IV + BYTES_TAG);
  const cifrado = datos.subarray(BYTES_IV + BYTES_TAG);
  const descifrador = crypto.createDecipheriv(ALGORITMO, llaveCifrado, iv);
  descifrador.setAuthTag(tag);
  return Buffer.concat([descifrador.update(cifrado), descifrador.final()]).toString('utf8');
}

export function hmac(texto) {
  return crypto.createHmac('sha256', llaveHmac).update(texto, 'utf8').digest();
}

/** Normaliza antes de cifrar o calcular el hmac, para que "Ana@Gmail.com" = "ana@gmail.com". */
export function normalizarCorreo(correo) {
  return correo.trim().toLowerCase();
}
