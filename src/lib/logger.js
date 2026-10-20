/**
 * Logger de la aplicación. Usa logger.info / .warn / .error en vez de console.log:
 * en producción genera JSON (legible por Render) y en desarrollo texto con colores.
 */
import pino from 'pino';
import { env, esProduccion } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport: esProduccion
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
