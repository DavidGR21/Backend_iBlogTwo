/**
 * Límite de intentos para rutas sensibles (login, registro, recuperar clave),
 * para frenar ataques de fuerza bruta.
 * limitarStickers: búsquedas de stickers por usuario, para no agotar la cuota de KLIPY.
 */
import { rateLimit } from 'express-rate-limit';
import { ErrorApp } from '../errores/ErrorApp.js';

export const limitarAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(ErrorApp.demasiadasPeticiones()),
});

export const limitarStickers = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => req.usuario.id, // va después de autenticar
  handler: (_req, _res, next) => next(ErrorApp.demasiadasPeticiones()),
});
