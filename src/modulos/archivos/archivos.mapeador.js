/**
 * Convierte filas de archivos en { id, url } para la API.
 */
export function aArchivo(fila, { url }) {
  return { id: fila.id, url };
}
