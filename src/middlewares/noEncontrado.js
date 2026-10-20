import { ErrorApp } from '../errores/ErrorApp.js';

/** Se ejecuta cuando ninguna ruta coincidió. */
export function noEncontrado(req, _res, next) {
  next(ErrorApp.noEncontrado(`No existe la ruta ${req.method} ${req.originalUrl}`));
}
