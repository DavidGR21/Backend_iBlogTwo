/**
 * Convierte filas en { id, autor, contenido, visibilidad, imagenes[], reacciones{}, miReaccion,
 * totalComentarios, editada, creadaEn }.
 * `autor` e `imagenes` llegan ya armados (con URLs firmadas) desde el servicio.
 */
export function aPublicacion(fila, { autor, imagenes }) {
  return {
    id: fila.id,
    autor,
    contenido: fila.contenido,
    visibilidad: fila.visibilidad,
    imagenes,
    reacciones: fila.reacciones ?? {},
    miReaccion: fila.mi_reaccion ?? null,
    totalComentarios: fila.total_comentarios ?? 0,
    editada: Boolean(fila.editada),
    creadaEn: fila.creado_en,
  };
}
