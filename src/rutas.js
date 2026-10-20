/**
 * Mapa de toda la API. Todas las rutas cuelgan de /api/v1 (ver app.js).
 * Para agregar un módulo nuevo: créalo en src/modulos/ y regístralo aquí.
 */
import { Router } from 'express';
import { rutasAuth } from './modulos/auth/auth.rutas.js';
import { rutasUsuarios } from './modulos/usuarios/usuarios.rutas.js';
import { rutasArchivos } from './modulos/archivos/archivos.rutas.js';
import { rutasPublicaciones } from './modulos/publicaciones/publicaciones.rutas.js';
import { rutasComentarios } from './modulos/comentarios/comentarios.rutas.js';
import { rutasAmistades } from './modulos/amistades/amistades.rutas.js';
import { rutasMensajes } from './modulos/mensajes/mensajes.rutas.js';

export const rutas = Router();

rutas.use('/auth', rutasAuth);
rutas.use('/usuarios', rutasUsuarios);
rutas.use('/archivos', rutasArchivos);
rutas.use('/publicaciones', rutasPublicaciones);
rutas.use('/comentarios', rutasComentarios);
rutas.use('/amistades', rutasAmistades);
rutas.use('/conversaciones', rutasMensajes);
