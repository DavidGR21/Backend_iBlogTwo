/**
 * Esquemas Zod: definen qué datos acepta cada endpoint de este módulo.
 * Las reglas deben coincidir con los CHECK de la base de datos.
 */
import { z } from 'zod';

export const nombreUsuario = z
  .string()
  .regex(/^[A-Za-z0-9_.]{3,30}$/, 'Entre 3 y 30 caracteres: letras, números, "_" o "."');

export const nombres = z
  .string()
  .trim()
  .min(1, 'Escribe tu nombre')
  .max(60, 'Máximo 60 caracteres');

export const apellidos = z.string().trim().max(60, 'Máximo 60 caracteres');

/** ISO 3166-1 alfa-2, igual que la tabla paises. Acepta "ec" y lo guarda como "EC". */
export const paisCodigo = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Código de país inválido');

/** Quita espacios y guiones: "+593 99 123-4567" → "+593991234567". */
const telefono = z
  .string()
  .transform((valor) => valor.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?[0-9]{7,15}$/, 'Teléfono inválido: solo números y + al inicio'));

const fechaNacimiento = z.iso
  .date('Fecha inválida (AAAA-MM-DD)')
  .refine(
    (fecha) => fecha >= '1900-01-01' && fecha <= new Date().toISOString().slice(0, 10),
    'La fecha debe estar entre 1900 y hoy',
  );

/** Convierte "" en null (borrar el dato) antes de validar. */
const opcionalBorrable = (esquema) =>
  z.preprocess((valor) => (valor === '' ? null : valor), esquema.nullable().optional());

export const esquemaParamsNombreUsuario = z.object({ nombreUsuario });

// Campo ausente = no se toca; campo en null = se borra (excepto nombres, que es obligatorio).
export const esquemaActualizarPerfil = z
  .object({
    nombres: nombres.optional(),
    apellidos: opcionalBorrable(apellidos),
    biografia: opcionalBorrable(z.string().trim().max(300, 'Máximo 300 caracteres')),
    paisCodigo: opcionalBorrable(paisCodigo),
    telefono: opcionalBorrable(telefono),
    fechaNacimiento: opcionalBorrable(fechaNacimiento),
    fotoPerfilId: z.uuid('Identificador de archivo inválido').nullable().optional(),
  })
  .strict();
