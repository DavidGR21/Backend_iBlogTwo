/**
 * Rutas de amistades → /api/v1/amistades  (todas autenticadas)
 *
 * Endpoints:
 *   [ ] GET    /                         Mis amigos (usa la vista v_amigos)
 *   [ ] GET    /solicitudes?tipo=recibidas|enviadas
 *   [ ] POST   /solicitudes              Enviar { destinatarioId }
 *   [ ] POST   /solicitudes/:id/aceptar  Solo el destinatario
 *   [ ] DELETE /:id                      Rechazar, cancelar o eliminar amigo (borra la fila)
 *
 * Tiempo real: EVENTOS.AMISTAD_SOLICITUD al destinatario, EVENTOS.AMISTAD_ACEPTADA al solicitante.
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';

export const rutasAmistades = Router();

rutasAmistades.use(autenticar);
