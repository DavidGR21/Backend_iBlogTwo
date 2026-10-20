/**
 * Valida params, query y body con esquemas de Zod antes de llegar al controlador.
 *
 *   router.post('/', validar({ body: esquemaCrearPublicacion }), controlador.crear);
 *
 * Los datos ya validados y limpios quedan en req.valido.params / .query / .body.
 * El controlador debe leer SIEMPRE de req.valido, nunca de req.body directo.
 */
import { ErrorApp } from '../errores/ErrorApp.js';

const PARTES = ['params', 'query', 'body'];

export function validar(esquemas) {
  return (req, _res, next) => {
    req.valido = {};
    for (const parte of PARTES) {
      if (!esquemas[parte]) continue;
      const resultado = esquemas[parte].safeParse(req[parte] ?? {});
      if (!resultado.success) {
        const detalles = resultado.error.issues.map((problema) => ({
          campo: [parte, ...problema.path].join('.'),
          mensaje: problema.message,
        }));
        return next(ErrorApp.solicitudInvalida('Datos inválidos', detalles));
      }
      req.valido[parte] = resultado.data;
    }
    next();
  };
}
