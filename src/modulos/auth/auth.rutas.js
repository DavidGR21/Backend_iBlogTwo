/**
 * Rutas de autenticación → /api/v1/auth
 *
 * Endpoints:
 *   [x] POST /registro            Crea usuario + perfil y envía correo de verificación
 *   [x] POST /verificar-correo    Recibe el token del enlace y marca correo_verificado_en
 *   [x] POST /reenviar-verificacion
 *   [x] POST /login               Con usuario o correo; devuelve token de acceso + cookie httpOnly con refresh token
 *   [x] POST /refrescar           Rota el refresh token y entrega un token de acceso nuevo
 *   [x] POST /logout              Revoca la sesión actual
 *   [x] POST /olvide-clave        Envía correo con enlace para restablecer
 *   [x] POST /restablecer-clave   Cambia la clave con el token y revoca todas las sesiones
 *
 * El límite de intentos se aplica a las rutas que reciben credenciales o envían
 * correos. /refrescar y /logout quedan fuera: el frontend llama a /refrescar en
 * cada carga de página y cada vez que expira el token de acceso.
 */
import { Router } from 'express';
import { limitarAuth } from '../../middlewares/limitarPeticiones.js';
import { validar } from '../../middlewares/validar.js';
import * as controlador from './auth.controlador.js';
import {
  esquemaLogin,
  esquemaRegistro,
  esquemaRestablecerClave,
  esquemaSoloCorreo,
  esquemaToken,
} from './auth.esquemas.js';

export const rutasAuth = Router();

rutasAuth.post('/registro', limitarAuth, validar({ body: esquemaRegistro }), controlador.registrar);
rutasAuth.post(
  '/verificar-correo',
  limitarAuth,
  validar({ body: esquemaToken }),
  controlador.verificarCorreo,
);
rutasAuth.post(
  '/reenviar-verificacion',
  limitarAuth,
  validar({ body: esquemaSoloCorreo }),
  controlador.reenviarVerificacion,
);
rutasAuth.post('/login', limitarAuth, validar({ body: esquemaLogin }), controlador.iniciarSesion);
rutasAuth.post('/refrescar', controlador.refrescar);
rutasAuth.post('/logout', controlador.cerrarSesion);
rutasAuth.post(
  '/olvide-clave',
  limitarAuth,
  validar({ body: esquemaSoloCorreo }),
  controlador.olvideClave,
);
rutasAuth.post(
  '/restablecer-clave',
  limitarAuth,
  validar({ body: esquemaRestablecerClave }),
  controlador.restablecerClave,
);
