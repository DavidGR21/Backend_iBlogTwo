/**
 * Rutas de comentarios y respuestas → /api/v1/comentarios
 *
 * Endpoints:
 *   [ ] GET    /?publicacionId=<id>&antesDe=…   Comentarios raíz de una publicación
 *   [ ] GET    /:id/respuestas                 Respuestas de un comentario
 *   [ ] POST   /                               Crear { publicacionId, contenido, comentarioPadreId? } (auth)
 *   [ ] PATCH  /:id                            Editar (solo autor)                                    (auth)
 *   [ ] DELETE /:id                            Borrado lógico (solo autor o autor del post)           (auth)
 *
 * Tiempo real: tras crear → EVENTOS.COMENTARIO_NUEVO a salaPublicacion(publicacionId)
 *              y notificación al autor del post con emitirAUsuario.
 */
import { Router } from 'express';

export const rutasComentarios = Router();
