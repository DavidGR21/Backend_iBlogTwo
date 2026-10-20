/**
 * Configuración de Express: middlewares globales, rutas y manejo de errores.
 * No arranca el servidor (eso es server.js), así se puede usar en pruebas.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { rutas } from './rutas.js';
import { noEncontrado } from './middlewares/noEncontrado.js';
import { manejarErrores } from './middlewares/manejarErrores.js';

export const app = express();

app.set('trust proxy', 1); // Render está detrás de un proxy: así req.ip es la IP real

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser()); // el refresh token viaja en una cookie httpOnly

// Verificación de vida: la usa Render y sirve para "despertar" el servidor.
app.get('/salud', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api/v1', rutas);

app.use(noEncontrado);
app.use(manejarErrores);
