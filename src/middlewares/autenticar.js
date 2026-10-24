/**
 * Exige un token de acceso válido. Deja al usuario en req.usuario = { id }.
 *
 *   router.post('/', autenticar, controlador.crear);
 *
 * autenticarOpcional: para rutas públicas que muestran más datos con sesión
 * (feed, perfil). Sin header sigue como invitado (req.usuario = null); con un
 * token inválido o expirado responde 401, así el frontend renueva y reintenta.
 *
 * Una cuenta recién suspendida por un administrador responde 401 aunque su token
 * siga vigente: el frontend intenta renovar, /refrescar la rechaza y cierra la sesión.
 */
import { ErrorApp } from '../errores/ErrorApp.js';
import { estaSuspendido } from '../lib/suspendidos.js';
import { verificarTokenAcceso } from '../lib/tokens.js';

export function autenticar(req, _res, next) {
  const encabezado = req.get('authorization');
  if (!encabezado?.startsWith('Bearer ')) {
    return next(ErrorApp.noAutenticado());
  }
  let usuario;
  try {
    usuario = verificarTokenAcceso(encabezado.slice('Bearer '.length));
  } catch {
    return next(ErrorApp.noAutenticado('Sesión inválida o expirada'));
  }
  if (estaSuspendido(usuario.id)) return next(ErrorApp.noAutenticado('Tu cuenta fue suspendida'));
  req.usuario = usuario;
  next();
}

export function autenticarOpcional(req, res, next) {
  if (!req.get('authorization')) {
    req.usuario = null;
    return next();
  }
  autenticar(req, res, next);
}
