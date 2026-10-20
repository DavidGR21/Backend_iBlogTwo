/**
 * Rutas de autenticación → /api/v1/auth  (todas con límite de intentos)
 *
 * Endpoints:
 *   [ ] POST /registro            Crea usuario + perfil y envía correo de verificación
 *   [ ] POST /verificar-correo    Recibe el token del enlace y marca correo_verificado_en
 *   [ ] POST /reenviar-verificacion
 *   [ ] POST /login               Devuelve token de acceso + cookie httpOnly con refresh token
 *   [ ] POST /refrescar           Rota el refresh token y entrega un token de acceso nuevo
 *   [ ] POST /logout              Revoca la sesión actual
 *   [ ] POST /olvide-clave        Envía correo con enlace para restablecer
 *   [ ] POST /restablecer-clave   Cambia la clave con el token y revoca todas las sesiones
 */
import { Router } from 'express';
import { limitarAuth } from '../../middlewares/limitarPeticiones.js';

export const rutasAuth = Router();

rutasAuth.use(limitarAuth);
