/**
 * Exige que el usuario con sesión sea administrador. Va siempre DESPUÉS de autenticar.
 *
 *   router.use(autenticar, exigirAdmin);
 *
 * El rol se lee de la BD en cada petición (no viaja en el token): quitarle el rol a
 * alguien surte efecto de inmediato. Responde 403 a quien no es admin.
 */
import { ErrorApp } from '../errores/ErrorApp.js';
import { esAdmin } from '../modulos/usuarios/usuarios.servicio.js';

export async function exigirAdmin(req, _res, next) {
  if (!(await esAdmin(req.usuario.id))) {
    throw ErrorApp.prohibido('Solo los administradores pueden entrar aquí');
  }
  next();
}
