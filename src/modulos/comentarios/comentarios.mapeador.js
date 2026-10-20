/**
 * Convierte filas en { id, publicacionId, comentarioPadreId, autor, contenido, eliminado,
 * totalRespuestas, creadoEn }. Si está eliminado, contenido = null.
 * `autor` llega ya armado (con la foto firmada) desde el servicio.
 */
export function aComentario(fila, { autor }) {
  const eliminado = fila.eliminado_en !== null;
  return {
    id: fila.id,
    publicacionId: fila.publicacion_id,
    comentarioPadreId: fila.comentario_padre_id,
    autor,
    contenido: eliminado ? null : fila.contenido,
    eliminado,
    totalRespuestas: fila.total_respuestas ?? 0,
    creadoEn: fila.creado_en,
  };
}
