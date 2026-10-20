/**
 * Reglas de archivos. Usa lib/almacenamiento.
 *  - Clave del objeto: '<destino>/<uuid>.<ext>' (ej. 'posts/3f2a….webp'); nunca el nombre original.
 *  - Solo el propietario puede confirmar o eliminar.
 *  - Al eliminar: borrar el objeto del bucket y marcar eliminado_en.
 *  - Exporta también `exigirArchivosPropios(ids, usuarioId)`, que usan
 *    publicaciones, perfiles y mensajes antes de enlazar un archivo.
 */
export {};
