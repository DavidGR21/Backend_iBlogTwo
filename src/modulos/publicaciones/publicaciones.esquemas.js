/**
 * Validaciones: contenido 1–5000 caracteres, visibilidad publico|amigos|privado,
 * archivoIds: hasta 10 uuid, tipo de reacción igual al enum tipo_reaccion de la BD.
 */
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion.js';

export const TIPOS_REACCION = [
  'me_gusta',
  'me_encanta',
  'me_divierte',
  'me_asombra',
  'me_entristece',
  'me_enoja',
  'me_disgusta',
];

const contenido = z
  .string()
  .trim()
  .min(1, 'La publicación no puede estar vacía')
  .max(5000, 'Máximo 5000 caracteres');

const visibilidad = z.enum(['publico', 'amigos', 'privado'], 'Visibilidad inválida');

export const idPublicacion = z.uuid('Identificador de publicación inválido');

export const esquemaParamsId = z.object({ id: idPublicacion });
export const esquemaParamsUsuario = z.object({ usuarioId: z.uuid('Usuario inválido') });
export const esquemaListar = esquemaPaginacion;

export const esquemaCrear = z.object({
  contenido,
  visibilidad: visibilidad.default('publico'),
  archivoIds: z
    .array(z.uuid('Imagen inválida'))
    .max(10, 'Máximo 10 imágenes por publicación')
    .refine((ids) => new Set(ids).size === ids.length, 'Hay imágenes repetidas')
    .default([]),
});

export const esquemaEditar = z
  .object({ contenido: contenido.optional(), visibilidad: visibilidad.optional() })
  .refine((datos) => datos.contenido !== undefined || datos.visibilidad !== undefined, {
    message: 'Envía contenido o visibilidad',
  });

export const esquemaReaccion = z.object({
  tipo: z.enum(TIPOS_REACCION, 'Tipo de reacción inválido'),
});
