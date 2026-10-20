/**
 * Validaciones de auth: registro (nombreUsuario, correo, clave, nombres…),
 * login, token de verificación y nueva clave.
 * Regla de clave: mínimo 8 caracteres, máximo 128.
 */
import { z } from 'zod';
import { apellidos, nombreUsuario, nombres, paisCodigo } from '../usuarios/usuarios.esquemas.js';

const correo = z
  .string()
  .trim()
  .max(254, 'Correo demasiado largo')
  .pipe(z.email('Correo inválido'));

const clave = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña no puede superar 128 caracteres');

const token = z.string().trim().min(10, 'Token inválido').max(200, 'Token inválido');

export const esquemaRegistro = z.object({
  nombreUsuario,
  correo,
  clave,
  nombres,
  apellidos: apellidos.optional(),
  paisCodigo: paisCodigo.optional(),
});

export const esquemaLogin = z.object({
  correo,
  clave: z.string().min(1, 'Escribe tu contraseña').max(128),
});

export const esquemaSoloCorreo = z.object({ correo });

export const esquemaToken = z.object({ token });

export const esquemaRestablecerClave = z.object({ token, clave });
