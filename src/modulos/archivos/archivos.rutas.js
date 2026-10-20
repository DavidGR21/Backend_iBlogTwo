/**
 * Rutas de archivos → /api/v1/archivos  (todas autenticadas)
 *
 * Flujo de subida (el backend nunca recibe los bytes):
 *   1. POST /subidas            { tipoMime, tamanoBytes, destino: 'perfil'|'post'|'mensaje' }
 *                               → crea fila 'pendiente' y devuelve { archivoId, urlSubida }
 *   2. El navegador hace PUT del archivo a urlSubida (directo a Neon Storage)
 *   3. POST /:id/confirmar      → verifica que el objeto exista y pasa a 'subido'
 *
 * Endpoints:
 *   [ ] POST   /subidas
 *   [ ] POST   /:id/confirmar
 *   [ ] DELETE /:id
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';

export const rutasArchivos = Router();

rutasArchivos.use(autenticar);
