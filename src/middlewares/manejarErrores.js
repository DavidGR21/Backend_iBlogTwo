/**
 * Último middleware de la app: convierte cualquier error en una respuesta JSON
 * con formato uniforme:
 *   { "error": { "codigo": "NO_ENCONTRADO", "mensaje": "...", "detalles": [...] } }
 *
 * Express 5 envía aquí automáticamente los errores de funciones async,
 * así que los controladores no necesitan try/catch.
 */
import { ErrorApp } from '../errores/ErrorApp.js';
import { logger } from '../lib/logger.js';

// Códigos de error de Postgres que se deben a datos del cliente, no a bugs.
const ERRORES_POSTGRES = {
  23505: { estado: 409, codigo: 'CONFLICTO', mensaje: 'El registro ya existe' },
  23503: {
    estado: 400,
    codigo: 'REFERENCIA_INVALIDA',
    mensaje: 'Hace referencia a algo que no existe',
  },
  23514: { estado: 400, codigo: 'DATOS_INVALIDOS', mensaje: 'Los datos no cumplen las reglas' },
};

export function manejarErrores(err, req, res, _next) {
  if (err instanceof ErrorApp) {
    return res.status(err.estado).json({
      error: { codigo: err.codigo, mensaje: err.message, detalles: err.detalles },
    });
  }

  const errorPostgres = ERRORES_POSTGRES[err?.code];
  if (errorPostgres) {
    return res.status(errorPostgres.estado).json({
      error: { codigo: errorPostgres.codigo, mensaje: errorPostgres.mensaje },
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es JSON válido' },
    });
  }

  logger.error({ err, metodo: req.method, ruta: req.originalUrl }, 'Error no controlado');
  return res.status(500).json({
    error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado' },
  });
}
