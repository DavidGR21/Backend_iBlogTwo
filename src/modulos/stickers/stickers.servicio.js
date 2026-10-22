/**
 * Stickers de KLIPY a través del backend:
 *  - tendencias / buscar: páginas { items, siguienteCursor } (el cursor es la página siguiente).
 *  - obtener(id): el sticker listo para guardarlo en un comentario o un mensaje.
 *
 * En modo Testing KLIPY admite 100 peticiones por hora, así que todo pasa por una caché en
 * memoria: las páginas viven unos minutos y cada sticker visto se recuerda por su id, de modo
 * que enviar uno que el usuario acaba de ver en el selector no gasta otra petición.
 */
import { env } from '../../config/env.js';
import { ErrorApp } from '../../errores/ErrorApp.js';
import { hmac } from '../../lib/cifrado.js';
import * as klipy from './stickers.cliente.js';
import { esUrlPermitida } from './stickers.contenido.js';

const POR_PAGINA = 24;
const VIDA_PAGINA_MS = 10 * 60 * 1000;
const VIDA_STICKER_MS = 24 * 60 * 60 * 1000;
const MAX_PAGINAS = 300;
const MAX_STICKERS = 3000;

const paginas = new Map(); // clave → { expira, datos }
const stickers = new Map(); // id → { expira, sticker }

function recordar(mapa, clave, valor, vida, maximo) {
  mapa.delete(clave);
  if (mapa.size >= maximo) mapa.delete(mapa.keys().next().value); // el más antiguo
  mapa.set(clave, { expira: Date.now() + vida, ...valor });
}

function vigente(mapa, clave) {
  const entrada = mapa.get(clave);
  if (!entrada) return null;
  if (entrada.expira < Date.now()) {
    mapa.delete(clave);
    return null;
  }
  return entrada;
}

/** El primer formato que exista y venga de static.klipy.com (webp anima y pesa poco). */
function archivo(file, tamanos) {
  for (const tamano of tamanos) {
    for (const formato of ['webp', 'gif', 'png']) {
      const candidato = file?.[tamano]?.[formato];
      if (candidato?.url && esUrlPermitida(candidato.url)) return candidato;
    }
  }
  return null;
}

/** Elemento de KLIPY → { id, titulo, url, miniatura, ancho, alto }, o null si no sirve. */
function aSticker(elemento) {
  if (elemento?.type && elemento.type !== 'sticker') return null; // p. ej. anuncios
  const grande = archivo(elemento?.file, ['md', 'hd', 'sm']);
  const pequeno = archivo(elemento?.file, ['sm', 'xs', 'md']);
  if (typeof elemento?.slug !== 'string' || !grande) return null;
  return {
    id: elemento.slug,
    titulo: elemento.title ?? '',
    url: grande.url,
    miniatura: (pequeno ?? grande).url,
    ancho: grande.width ?? null,
    alto: grande.height ?? null,
  };
}

// customer_id estable por usuario, sin mandar a KLIPY su id real
const clienteDe = (usuarioId) => hmac(`klipy:${usuarioId}`).toString('hex').slice(0, 32);

async function pagina(recurso, { usuarioId, numero, q }) {
  const clave = `${recurso}:${q ?? ''}:${numero}`;
  const enCache = vigente(paginas, clave);
  if (enCache) return enCache.datos;

  const datos = await klipy.pedir(recurso, {
    page: numero,
    per_page: POR_PAGINA,
    q,
    customer_id: clienteDe(usuarioId),
    content_filter: env.KLIPY_FILTRO_CONTENIDO,
  });

  const items = (Array.isArray(datos.data) ? datos.data : []).map(aSticker).filter(Boolean);
  for (const sticker of items) {
    recordar(stickers, sticker.id, { sticker }, VIDA_STICKER_MS, MAX_STICKERS);
  }
  const resultado = { items, siguienteCursor: datos.has_next ? String(numero + 1) : null };
  recordar(paginas, clave, { datos: resultado }, VIDA_PAGINA_MS, MAX_PAGINAS);
  return resultado;
}

export const disponible = () => klipy.configurado();

export const tendencias = (usuarioId, { antesDe }) =>
  pagina('trending', { usuarioId, numero: antesDe });

export const buscar = (usuarioId, { q, antesDe }) =>
  pagina('search', { usuarioId, numero: antesDe, q: q.toLowerCase() });

/** Sticker por id (slug). Lanza 400 si KLIPY no lo conoce. */
export async function obtener(id) {
  const enCache = vigente(stickers, id);
  if (enCache) return enCache.sticker;

  const datos = await klipy.pedir('items', { slugs: id });
  const sticker = (Array.isArray(datos.data) ? datos.data : [])
    .map(aSticker)
    .find((s) => s?.id === id);
  if (!sticker) throw ErrorApp.solicitudInvalida('Ese sticker ya no está disponible');
  recordar(stickers, id, { sticker }, VIDA_STICKER_MS, MAX_STICKERS);
  return sticker;
}
