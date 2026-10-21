/**
 * Rutas de publicaciones y reacciones → /api/v1/publicaciones
 *
 * Endpoints:
 *   [x] GET    /                 Feed (paginado por cursor: ?antesDe=<cursor>&limite=20)
 *   [x] GET    /usuario/:id      Publicaciones de un usuario
 *   [x] POST   /                 Crear { contenido, visibilidad, archivoIds[] }       (auth)
 *   [x] GET    /:id              Ver una publicación (respeta visibilidad)
 *   [x] PATCH  /:id              Editar contenido/visibilidad/imágenes (solo autor)  (auth)
 *   [x] DELETE /:id              Borrado lógico (solo autor)                          (auth)
 *   [x] PUT    /:id/reaccion     Poner o cambiar reacción { tipo }                    (auth)
 *   [x] DELETE /:id/reaccion     Quitar mi reacción                                   (auth)
 *
 * Las lecturas son públicas, pero con sesión incluyen lo de amigos, lo propio y miReaccion.
 *
 * Tiempo real: tras crear → EVENTOS.PUBLICACION_NUEVA;
 *              tras reaccionar → EVENTOS.REACCION_ACTUALIZADA a salaPublicacion(id).
 */
import { Router } from 'express';
import { autenticar, autenticarOpcional } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './publicaciones.controlador.js';
import {
  esquemaCrear,
  esquemaEditar,
  esquemaListar,
  esquemaParamsId,
  esquemaParamsUsuario,
  esquemaReaccion,
} from './publicaciones.esquemas.js';

export const rutasPublicaciones = Router();

rutasPublicaciones.get(
  '/',
  autenticarOpcional,
  validar({ query: esquemaListar }),
  controlador.listarFeed,
);
rutasPublicaciones.get(
  '/usuario/:usuarioId',
  autenticarOpcional,
  validar({ params: esquemaParamsUsuario, query: esquemaListar }),
  controlador.listarDeUsuario,
);
rutasPublicaciones.post('/', autenticar, validar({ body: esquemaCrear }), controlador.crear);

rutasPublicaciones.get(
  '/:id',
  autenticarOpcional,
  validar({ params: esquemaParamsId }),
  controlador.ver,
);
rutasPublicaciones.patch(
  '/:id',
  autenticar,
  validar({ params: esquemaParamsId, body: esquemaEditar }),
  controlador.editar,
);
rutasPublicaciones.delete(
  '/:id',
  autenticar,
  validar({ params: esquemaParamsId }),
  controlador.eliminar,
);

rutasPublicaciones.put(
  '/:id/reaccion',
  autenticar,
  validar({ params: esquemaParamsId, body: esquemaReaccion }),
  controlador.reaccionar,
);
rutasPublicaciones.delete(
  '/:id/reaccion',
  autenticar,
  validar({ params: esquemaParamsId }),
  controlador.quitarReaccion,
);
