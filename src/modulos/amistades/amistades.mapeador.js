/**
 * Formas de la API:
 *  - Amigo:     { id, usuario: UsuarioResumen, desde }
 *  - Solicitud: { id, usuario: UsuarioResumen, creadaEn }
 *  - Relación (en el perfil): { id, estado, soyElSolicitante }
 * `usuario` llega ya armado (con la foto firmada) desde el servicio.
 */
export function aAmigo(fila, usuario) {
  return { id: fila.id, usuario, desde: fila.aceptada_en };
}

export function aSolicitud(fila, usuario) {
  return { id: fila.id, usuario, creadaEn: fila.creado_en };
}

export function aRelacion(fila, usuarioId) {
  return {
    id: fila.id,
    estado: fila.estado,
    soyElSolicitante: fila.solicitante_id === usuarioId,
  };
}
