/**
 * Pool de conexiones a Neon (Postgres).
 * Solo los repositorios y db/transaccion.js deberían importar este archivo.
 */
import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 5, // suficiente para la instancia gratuita de Render
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Error en una conexión inactiva de Postgres');
});
