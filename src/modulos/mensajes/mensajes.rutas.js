/**
 * Rutas de mensajería → /api/v1/conversaciones  (todas autenticadas)
 * El ENVÍO de mensajes va por Socket.io (mensajes.sockets.js); por HTTP solo se consulta.
 *
 * Endpoints:
 *   [ ] GET  /                            Mis conversaciones (orden: ultimo_mensaje_en DESC)
 *   [ ] POST /                            Abrir o recuperar chat 1 a 1 con un amigo { amigoId }
 *   [ ] GET  /:id/mensajes?antesDe=<id>   Historial paginado por cursor (mensajes.id)
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';

export const rutasMensajes = Router();

rutasMensajes.use(autenticar);
