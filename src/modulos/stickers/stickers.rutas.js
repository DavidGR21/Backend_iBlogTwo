/**
 * Rutas de stickers (KLIPY) → /api/v1/stickers
 *
 * Endpoints:
 *   [x] GET /estado                       { disponible } (hay llave de KLIPY)
 *   [x] GET /tendencias?antesDe=<página>   { items: Sticker[], siguienteCursor }    (auth)
 *   [x] GET /buscar?q=gato&antesDe=…       { items: Sticker[], siguienteCursor }    (auth)
 *
 * Sticker = { id, titulo, url, miniatura, ancho, alto }. Para enviarlo, comentarios y
 * mensajes reciben `stickerId` y el backend lo vuelve a comprobar contra KLIPY.
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { limitarStickers } from '../../middlewares/limitarPeticiones.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './stickers.controlador.js';
import { esquemaBuscar, esquemaTendencias } from './stickers.esquemas.js';

export const rutasStickers = Router();

rutasStickers.get('/estado', controlador.estado); // público: solo dice si hay llave
rutasStickers.get(
  '/tendencias',
  autenticar,
  limitarStickers,
  validar({ query: esquemaTendencias }),
  controlador.tendencias,
);
rutasStickers.get(
  '/buscar',
  autenticar,
  limitarStickers,
  validar({ query: esquemaBuscar }),
  controlador.buscar,
);
