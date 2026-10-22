/**
 * Un sticker se guarda dentro del `contenido` de un comentario o de un mensaje (así no hace
 * falta tocar la BD): PREFIJO + JSON con lo justo para dibujarlo sin volver a llamar a KLIPY.
 *
 *   [[sticker]]{"i":"grrr-rawr-sticker","t":"Grrr Rawr","u":"https://static.klipy.com/…","w":200,"h":200}
 *
 * Solo el backend escribe ese formato: los textos de los usuarios no pueden empezar por el
 * prefijo (ver `esTextoReservado`), y al leer solo se aceptan URLs https de static.klipy.com.
 */
const PREFIJO = '[[sticker]]';
const HOST_PERMITIDO = 'static.klipy.com';
const MAX_TITULO = 100;

export const esTextoReservado = (texto) => texto.trimStart().startsWith(PREFIJO);

export function esUrlPermitida(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && hostname === HOST_PERMITIDO;
  } catch {
    return false;
  }
}

/** { id, titulo, url, ancho, alto } → texto para guardar. */
export function codificarSticker({ id, titulo, url, ancho, alto }) {
  return `${PREFIJO}${JSON.stringify({
    i: id,
    t: (titulo ?? '').slice(0, MAX_TITULO),
    u: url,
    w: ancho,
    h: alto,
  })}`;
}

/** Texto guardado → { id, titulo, url, ancho, alto }, o null si no es un sticker válido. */
export function leerSticker(texto) {
  if (typeof texto !== 'string' || !texto.startsWith(PREFIJO)) return null;
  try {
    const { i, t, u, w, h } = JSON.parse(texto.slice(PREFIJO.length));
    if (typeof i !== 'string' || !esUrlPermitida(u)) return null;
    return {
      id: i,
      titulo: typeof t === 'string' ? t : '',
      url: u,
      ancho: Number.isFinite(w) ? w : null,
      alto: Number.isFinite(h) ? h : null,
    };
  } catch {
    return null;
  }
}

/** Separa un contenido guardado en { contenido, sticker } para las respuestas de la API. */
export function separarContenido(texto) {
  const sticker = leerSticker(texto);
  return sticker ? { contenido: null, sticker } : { contenido: texto ?? null, sticker: null };
}
