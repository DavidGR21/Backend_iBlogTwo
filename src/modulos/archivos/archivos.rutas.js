/**
 * Rutas de archivos → /api/v1/archivos  (todas autenticadas)
 *
 * Flujo de subida (el backend nunca recibe los bytes):
 *   1. POST /subidas            { tipoMime, tamanoBytes, destino: 'perfil'|'post'|'mensaje' }
 *                               → crea fila 'pendiente' y devuelve { archivoId, urlSubida }
 *   2. El navegador hace PUT del archivo a urlSubida (directo a Neon Storage)
 *   3. POST /:id/confirmar      → verifica que el objeto exista y pasa a 'subido' → { id, url }
 *
 * Endpoints:
 *   [x] POST   /subidas
 *   [x] POST   /:id/confirmar
 *   [x] DELETE /:id
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './archivos.controlador.js';
import { esquemaParamsId, esquemaSolicitarSubida } from './archivos.esquemas.js';

export const rutasArchivos = Router();

rutasArchivos.use(autenticar);

rutasArchivos.post(
  '/subidas',
  validar({ body: esquemaSolicitarSubida }),
  controlador.solicitarSubida,
);
rutasArchivos.post(
  '/:id/confirmar',
  validar({ params: esquemaParamsId }),
  controlador.confirmarSubida,
);
rutasArchivos.delete('/:id', validar({ params: esquemaParamsId }), controlador.eliminar);
