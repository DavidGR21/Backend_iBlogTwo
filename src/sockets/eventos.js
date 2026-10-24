/**
 * Catálogo ÚNICO de nombres de eventos de Socket.io.
 *
 * Nunca escribas el nombre de un evento como texto suelto en otro archivo:
 * importa EVENTOS. Copia este archivo al frontend para que ambos lados
 * usen exactamente los mismos nombres.
 *
 * Convención: "recurso:accion".
 */
export const EVENTOS = Object.freeze({
  // ── Cliente → servidor ─────────────────────────────
  PUBLICACION_UNIRSE: 'publicacion:unirse', // ver una publicación en vivo
  PUBLICACION_SALIR: 'publicacion:salir',
  MENSAJE_ENVIAR: 'mensaje:enviar',
  MENSAJE_LEIDO: 'mensaje:leido',
  CONVERSACION_ESCRIBIENDO: 'conversacion:escribiendo',

  // ── Servidor → cliente ─────────────────────────────
  PUBLICACION_NUEVA: 'publicacion:nueva',
  PUBLICACION_ELIMINADA: 'publicacion:eliminada', // { publicacionId }: quitarla de las listas
  REACCION_ACTUALIZADA: 'reaccion:actualizada',
  COMENTARIO_NUEVO: 'comentario:nuevo',
  AMISTAD_SOLICITUD: 'amistad:solicitud',
  AMISTAD_ACEPTADA: 'amistad:aceptada',
  MENSAJE_NUEVO: 'mensaje:nuevo',
});
