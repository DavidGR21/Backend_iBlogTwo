/**
 * Rutas del módulo usuarios → /api/v1/usuarios
 *
 * MÓDULO DE EJEMPLO: muestra el recorrido completo de una petición
 *   rutas → validar → controlador → servicio → repositorio → mapeador
 * Úsalo como plantilla para los demás módulos.
 *
 * Endpoints:
 *   [x] GET   /:nombreUsuario   Perfil público de un usuario (+ "amistad" si hay sesión)
 *   [x] GET   /yo               Mi cuenta y perfil (autenticado)
 *   [x] PATCH /yo/perfil        Editar mi perfil (autenticado)
 *
 * Importante: registra /yo ANTES de /:nombreUsuario, o "yo" se tomaría
 * como nombre de usuario.
 */
import { Router } from 'express';
import { autenticar, autenticarOpcional } from '../../middlewares/autenticar.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './usuarios.controlador.js';
import { esquemaActualizarPerfil, esquemaParamsNombreUsuario } from './usuarios.esquemas.js';

export const rutasUsuarios = Router();

rutasUsuarios.get('/yo', autenticar, controlador.verYo);

rutasUsuarios.patch(
  '/yo/perfil',
  autenticar,
  validar({ body: esquemaActualizarPerfil }),
  controlador.actualizarPerfil,
);

rutasUsuarios.get(
  '/:nombreUsuario',
  autenticarOpcional,
  validar({ params: esquemaParamsNombreUsuario }),
  controlador.verPerfilPublico,
);
