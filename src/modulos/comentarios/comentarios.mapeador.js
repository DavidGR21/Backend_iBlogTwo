/**
 * Convierte filas en { id, publicacionId, comentarioPadreId, autor, contenido, sticker,
 * eliminado, totalRespuestas, creadoEn }. Si está eliminado, contenido y sticker = null.
 * Un comentario de sticker trae contenido = null y sticker = { id, titulo, url, ancho, alto }.
 * `autor` llega ya armado (con la foto firmada) desde el servicio.
 */
import { separarContenido } from '../stickers/stickers.contenido.js';

export function aComentario(fila, { autor }) {
  const eliminado = fila.eliminado_en !== null;
  const { contenido, sticker } = eliminado
    ? { contenido: null, sticker: null }
    : separarContenido(fila.contenido);
  return {
    id: fila.id,
    publicacionId: fila.publicacion_id,
    comentarioPadreId: fila.comentario_padre_id,
    autor,
    contenido,
    sticker,
    eliminado,
    totalRespuestas: fila.total_respuestas ?? 0,
    creadoEn: fila.creado_en,
  };
}
