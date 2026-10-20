/**
 * Exige un token de acceso válido. Deja al usuario en req.usuario = { id }.
 *
 *   router.post('/', autenticar, controlador.crear);
 */
import { ErrorApp } from '../errores/ErrorApp.js';
import { verificarTokenAcceso } from '../lib/tokens.js';

export function autenticar(req, _res, next) {
  const encabezado = req.get('authorization');
  if (!encabezado?.startsWith('Bearer ')) {
    return next(ErrorApp.noAutenticado());
  }
  try {
    req.usuario = verificarTokenAcceso(encabezado.slice('Bearer '.length));
    next();
  } catch {
    next(ErrorApp.noAutenticado('Sesión inválida o expirada'));
  }
}
