/**
 * Rutas de comentarios y respuestas → /api/v1/comentarios
 *
 * Endpoints:
 *   [x] GET    /?publicacionId=<id>&antesDe=…   Comentarios raíz de una publicación
 *   [x] GET    /:id/respuestas                 Respuestas de un comentario
 *   [x] POST   /                               Crear { publicacionId, contenido, comentarioPadreId? } (auth)
 *   [x] PATCH  /:id                            Editar (solo autor)                                    (auth)
 *   [x] DELETE /:id                            Borrado lógico (solo autor o autor del post)           (auth)
 *
 * Tiempo real: tras crear → EVENTOS.COMENTARIO_NUEVO a salaPublicacion(publicacionId).
 */
import { Router } from 'express';
import { autenticar, autenticarOpcional } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './comentarios.controlador.js';
import {
  esquemaCrear,
  esquemaEditar,
  esquemaListar,
  esquemaParamsId,
} from './comentarios.esquemas.js';

export const rutasComentarios = Router();

rutasComentarios.get(
  '/',
  autenticarOpcional,
  validar({ query: esquemaListar }),
  controlador.listarDePublicacion,
);
rutasComentarios.get(
  '/:id/respuestas',
  autenticarOpcional,
  validar({ params: esquemaParamsId }),
  controlador.listarRespuestas,
);
rutasComentarios.post('/', autenticar, validar({ body: esquemaCrear }), controlador.crear);
rutasComentarios.patch(
  '/:id',
  autenticar,
  validar({ params: esquemaParamsId, body: esquemaEditar }),
  controlador.editar,
);
rutasComentarios.delete(
  '/:id',
  autenticar,
  validar({ params: esquemaParamsId }),
  controlador.eliminar,
);
