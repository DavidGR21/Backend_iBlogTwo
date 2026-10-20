/**
 * Reglas de publicaciones:
 *  - Crear en transacción: publicaciones + publicacion_archivos (archivos propios y 'subido').
 *  - Visibilidad: 'publico' para todos, 'amigos' solo amigos (v_amigos), 'privado' solo el autor.
 *  - Reaccionar = INSERT … ON CONFLICT (publicacion_id, usuario_id) DO UPDATE SET tipo.
 *  - Después de guardar, emitir el evento con sockets/emisor.js.
 */
export {};
