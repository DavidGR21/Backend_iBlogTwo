/**
 * Rutas de amistades → /api/v1/amistades  (todas autenticadas)
 *
 * Endpoints:
 *   [x] GET    /                         Mis amigos (usa la vista v_amigos)
 *   [x] GET    /solicitudes?tipo=recibidas|enviadas
 *   [x] POST   /solicitudes              Enviar { destinatarioId }
 *   [x] POST   /solicitudes/:id/aceptar  Solo el destinatario
 *   [x] DELETE /:id                      Rechazar, cancelar o eliminar amigo (borra la fila)
 *
 * Tiempo real: EVENTOS.AMISTAD_SOLICITUD al destinatario, EVENTOS.AMISTAD_ACEPTADA al solicitante.
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './amistades.controlador.js';
import {
  esquemaEnviarSolicitud,
  esquemaListarSolicitudes,
  esquemaParamsId,
} from './amistades.esquemas.js';

export const rutasAmistades = Router();

rutasAmistades.use(autenticar);

rutasAmistades.get('/', controlador.listarAmigos);
rutasAmistades.get(
  '/solicitudes',
  validar({ query: esquemaListarSolicitudes }),
  controlador.listarSolicitudes,
);
rutasAmistades.post(
  '/solicitudes',
  validar({ body: esquemaEnviarSolicitud }),
  controlador.enviarSolicitud,
);
rutasAmistades.post(
  '/solicitudes/:id/aceptar',
  validar({ params: esquemaParamsId }),
  controlador.aceptarSolicitud,
);
rutasAmistades.delete('/:id', validar({ params: esquemaParamsId }), controlador.eliminar);
