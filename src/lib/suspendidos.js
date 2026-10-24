/**
 * Cuentas suspendidas recientemente, en memoria.
 *
 * El token de acceso (JWT de 15 min) no consulta la BD en cada petición: al suspender
 * una cuenta se revocan sus sesiones, pero su token de acceso seguiría sirviendo hasta
 * expirar. Esta lista cierra ese hueco: autenticar y autenticarSocket la consultan.
 * Basta con recordar cada cuenta 15 minutos (lo que dura un token de acceso); después,
 * /refrescar y /restaurar ya rechazan la cuenta porque no está activa.
 */
const DURACION_MS = 15 * 60 * 1000;
const suspendidos = new Map(); // usuarioId → momento de la suspensión (ms)

export function marcarSuspendido(usuarioId) {
  suspendidos.set(usuarioId, Date.now());
}

export function quitarSuspendido(usuarioId) {
  suspendidos.delete(usuarioId);
}

export function estaSuspendido(usuarioId) {
  const desde = suspendidos.get(usuarioId);
  if (desde === undefined) return false;
  if (Date.now() - desde > DURACION_MS) {
    suspendidos.delete(usuarioId);
    return false;
  }
  return true;
}
