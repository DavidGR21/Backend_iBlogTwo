/**
 * Rutas de publicaciones y reacciones → /api/v1/publicaciones
 *
 * Endpoints:
 *   [ ] GET    /                 Feed (paginado por cursor: ?antesDe=<fecha>&limite=20)
 *   [ ] GET    /usuario/:id      Publicaciones de un usuario
 *   [ ] POST   /                 Crear { contenido, visibilidad, archivoIds[] }       (auth)
 *   [ ] GET    /:id              Ver una publicación (respeta visibilidad)
 *   [ ] PATCH  /:id              Editar contenido/visibilidad (solo autor)           (auth)
 *   [ ] DELETE /:id              Borrado lógico (solo autor)                          (auth)
 *   [ ] PUT    /:id/reaccion     Poner o cambiar reacción { tipo }                    (auth)
 *   [ ] DELETE /:id/reaccion     Quitar mi reacción                                   (auth)
 *
 * Tiempo real: tras crear → EVENTOS.PUBLICACION_NUEVA;
 *              tras reaccionar → EVENTOS.REACCION_ACTUALIZADA a salaPublicacion(id).
 */
import { Router } from 'express';

export const rutasPublicaciones = Router();
