/**
 * Llamadas HTTP a la API de stickers de KLIPY (https://docs.klipy.com/stickers-api).
 *   GET api/v1/{llave}/stickers/trending, /search y /items
 * Respuesta: { result, data: { data: [{ slug, title, type, file: { hd|md|sm|xs: { webp|gif|png:
 *   { url, width, height } } } }], current_page, per_page, has_next } }
 * La llave solo vive en el backend: el frontend nunca habla con KLIPY directamente.
 */
import { env } from '../../config/env.js';
import { ErrorApp } from '../../errores/ErrorApp.js';
import { logger } from '../../lib/logger.js';

const URL_BASE = 'https://api.klipy.com/api/v1';
const ESPERA_MS = 8_000;

export const configurado = () => Boolean(env.KLIPY_API_KEY);

export async function pedir(recurso, parametros = {}) {
  if (!configurado()) throw ErrorApp.noDisponible('Los stickers no están configurados');

  const url = new URL(`${URL_BASE}/${encodeURIComponent(env.KLIPY_API_KEY)}/stickers/${recurso}`);
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== null) url.searchParams.set(clave, String(valor));
  }

  let respuesta;
  try {
    respuesta = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (err) {
    logger.warn({ err: err.message, recurso }, 'KLIPY no respondió');
    throw ErrorApp.noDisponible('El servicio de stickers no responde');
  }

  if (respuesta.status === 429) {
    throw ErrorApp.demasiadasPeticiones('Se alcanzó el límite de stickers, prueba en un rato');
  }
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !cuerpo?.result) {
    // Sin la URL en el log: lleva la llave dentro
    logger.warn({ estado: respuesta.status, recurso }, 'KLIPY respondió con error');
    throw ErrorApp.noDisponible('El servicio de stickers falló');
  }
  return cuerpo.data ?? {};
}
