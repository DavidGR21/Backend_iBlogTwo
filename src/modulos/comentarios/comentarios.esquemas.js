/**
 * Validaciones: contenido 1–2000 caracteres, publicacionId y comentarioPadreId uuid.
 */
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion.js';

const contenido = z
  .string()
  .trim()
  .min(1, 'El comentario no puede estar vacío')
  .max(2000, 'Máximo 2000 caracteres');

export const esquemaParamsId = z.object({ id: z.uuid('Identificador inválido') });

export const esquemaListar = esquemaPaginacion.extend({
  publicacionId: z.uuid('Publicación inválida'),
});

export const esquemaCrear = z.object({
  publicacionId: z.uuid('Publicación inválida'),
  contenido,
  comentarioPadreId: z.uuid('Comentario inválido').nullish(),
});

export const esquemaEditar = z.object({ contenido });
