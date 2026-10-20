/**
 * Punto de entrada: levanta HTTP + WebSockets en el mismo puerto
 * y cierra todo ordenadamente cuando Render reinicia el servicio.
 */
import { createServer } from 'node:http';
import { env } from './config/env.js';
import { app } from './app.js';
import { crearServidorSockets } from './sockets/index.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';

const servidorHttp = createServer(app);
const io = crearServidorSockets(servidorHttp);

servidorHttp.listen(env.PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let apagando = false;
async function apagar(senal) {
  if (apagando) return;
  apagando = true;
  logger.info(`${senal} recibido: cerrando conexiones…`);
  io.close(); // cierra los sockets y también el servidor HTTP
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
