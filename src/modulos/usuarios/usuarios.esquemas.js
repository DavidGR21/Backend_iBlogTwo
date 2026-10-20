/**
 * Esquemas Zod: definen qué datos acepta cada endpoint de este módulo.
 * Las reglas deben coincidir con los CHECK de la base de datos.
 */
import { z } from 'zod';

export const nombreUsuario = z
  .string()
  .regex(/^[A-Za-z0-9_.]{3,30}$/, 'Entre 3 y 30 caracteres: letras, números, "_" o "."');

export const esquemaParamsNombreUsuario = z.object({ nombreUsuario });
