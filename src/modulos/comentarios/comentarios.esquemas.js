/**
 * Validaciones: contenido 1–2000 caracteres, publicacionId y comentarioPadreId uuid.
 * Un comentario es texto (`contenido`) o un sticker de KLIPY (`stickerId`), nunca ambos.
 */
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion.js';
import { esTextoReservado } from '../stickers/stickers.contenido.js';
import { idSticker } from '../stickers/stickers.esquemas.js';

const contenido = z
  .string()
  .trim()
  .min(1, 'El comentario no puede estar vacío')
  .max(2000, 'Máximo 2000 caracteres')
  .refine((texto) => !esTextoReservado(texto), 'Ese texto no está permitido');

export const esquemaParamsId = z.object({ id: z.uuid('Identificador inválido') });

export const esquemaListar = esquemaPaginacion.extend({
  publicacionId: z.uuid('Publicación inválida'),
});

export const esquemaCrear = z
  .object({
    publicacionId: z.uuid('Publicación inválida'),
    contenido: contenido.optional(),
    stickerId: idSticker.optional(),
    comentarioPadreId: z.uuid('Comentario inválido').nullish(),
  })
  .refine(
    (datos) => (datos.contenido === undefined) !== (datos.stickerId === undefined),
    'Envía un texto o un sticker',
  );

export const esquemaEditar = z.object({ contenido });
