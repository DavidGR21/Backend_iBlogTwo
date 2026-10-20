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
import { limpiarHuerfanos } from './modulos/archivos/archivos.servicio.js';

const servidorHttp = createServer(app);
const io = crearServidorSockets(servidorHttp);

servidorHttp.listen(env.PORT, () => {
  logger.info(`Servidor escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Cada hora: borrar del bucket las subidas que nunca se confirmaron.
const limpieza = setInterval(
  () => limpiarHuerfanos().catch((err) => logger.error({ err }, 'Falló la limpieza de archivos')),
  60 * 60 * 1000,
);
limpieza.unref(); // no impide que el proceso termine

let apagando = false;
async function apagar(senal) {
  if (apagando) return;
  apagando = true;
  clearInterval(limpieza);
  logger.info(`${senal} recibido: cerrando conexiones…`);
  io.close(); // cierra los sockets y también el servidor HTTP
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
