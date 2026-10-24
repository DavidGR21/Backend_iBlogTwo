/**
 * Panel de administración → /api/v1/admin   (todas exigen sesión + rol admin)
 *
 * Endpoints:
 *   [x] GET    /estadisticas                     Totales, actividad de 14 días y cuentas más activas
 *   [x] GET    /usuarios                         ?buscar (usuario, nombre o correo) &filtro &antesDe &limite
 *   [x] GET    /usuarios/:id                     Ficha completa de una cuenta
 *   [x] POST   /usuarios/:id/suspender           Banear { motivo?, borrarContenido? }
 *   [x] POST   /usuarios/:id/reactivar           Quitar el baneo
 *   [x] POST   /usuarios/:id/verificar-correo    Marcar el correo como verificado
 *   [x] POST   /usuarios/:id/cerrar-sesiones     Revocar todas sus sesiones
 *   [x] DELETE /usuarios/:id/foto                Quitar su foto de perfil (y borrarla del bucket)
 *   [x] DELETE /usuarios/:id/contenido           Borrar todas sus publicaciones y comentarios
 *   [x] GET    /publicaciones                    ?buscar &autorId &estado=vivas|eliminadas|todas
 *   [x] DELETE /publicaciones/:id                Borrar cualquier publicación (+ imágenes del bucket)
 *   [x] GET    /comentarios                      ?buscar &autorId &estado
 *   [x] DELETE /comentarios/:id                  Borrar cualquier comentario
 *   [x] GET    /registro                         Acciones de los administradores
 *   [x] POST   /mantenimiento/limpiar-archivos   Borrar ya del bucket lo que no se usa
 *
 * Quién es admin se decide en la BD (usuarios.rol); se asigna con: npm run admin -- <usuario>
 */
import { Router } from 'express';
import { autenticar } from '../../middlewares/autenticar.js';
import { exigirAdmin } from '../../middlewares/exigirAdmin.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './admin.controlador.js';
import {
  esquemaListarContenido,
  esquemaListarRegistro,
  esquemaListarUsuarios,
  esquemaParamsId,
  esquemaSuspender,
} from './admin.esquemas.js';

export const rutasAdmin = Router();

rutasAdmin.use(autenticar, exigirAdmin);

const conId = validar({ params: esquemaParamsId });

rutasAdmin.get('/estadisticas', controlador.estadisticas);

rutasAdmin.get('/usuarios', validar({ query: esquemaListarUsuarios }), controlador.listarUsuarios);
rutasAdmin.get('/usuarios/:id', conId, controlador.verUsuario);
rutasAdmin.post(
  '/usuarios/:id/suspender',
  validar({ params: esquemaParamsId, body: esquemaSuspender }),
  controlador.suspender,
);
rutasAdmin.post('/usuarios/:id/reactivar', conId, controlador.reactivar);
rutasAdmin.post('/usuarios/:id/verificar-correo', conId, controlador.verificarCorreo);
rutasAdmin.post('/usuarios/:id/cerrar-sesiones', conId, controlador.cerrarSesiones);
rutasAdmin.delete('/usuarios/:id/foto', conId, controlador.quitarFoto);
rutasAdmin.delete('/usuarios/:id/contenido', conId, controlador.borrarContenido);

rutasAdmin.get(
  '/publicaciones',
  validar({ query: esquemaListarContenido }),
  controlador.listarPublicaciones,
);
rutasAdmin.delete('/publicaciones/:id', conId, controlador.eliminarPublicacion);

rutasAdmin.get(
  '/comentarios',
  validar({ query: esquemaListarContenido }),
  controlador.listarComentarios,
);
rutasAdmin.delete('/comentarios/:id', conId, controlador.eliminarComentario);

rutasAdmin.get('/registro', validar({ query: esquemaListarRegistro }), controlador.listarRegistro);
rutasAdmin.post('/mantenimiento/limpiar-archivos', controlador.limpiarArchivos);
