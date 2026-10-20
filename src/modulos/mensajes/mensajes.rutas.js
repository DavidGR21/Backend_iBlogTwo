/**
 * Rutas de mensajería → /api/v1/conversaciones  (todas autenticadas)
 * El ENVÍO de mensajes va por Socket.io (mensajes.sockets.js); por HTTP solo se consulta.
 *
 * Endpoints:
 *   [x] GET  /                            Mis conversaciones (orden: ultimo_mensaje_en DESC)
 *   [x] POST /                            Abrir o recuperar chat 1 a 1 con un amigo { amigoId }
 *   [x] GET  /:id/mensajes?antesDe=<id>   Historial paginado por cursor (mensajes.id)
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './mensajes.controlador.js';
import { esquemaAbrir, esquemaListarMensajes, esquemaParamsId } from './mensajes.esquemas.js';

export const rutasMensajes = Router();

rutasMensajes.use(autenticar);

rutasMensajes.get('/', controlador.listarConversaciones);
rutasMensajes.post('/', validar({ body: esquemaAbrir }), controlador.abrirConversacion);
rutasMensajes.get(
  '/:id/mensajes',
  validar({ params: esquemaParamsId, query: esquemaListarMensajes }),
  controlador.listarMensajes,
);
