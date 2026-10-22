/**
 * Validaciones (HTTP y sockets): amigoId uuid, contenido 1–4000 caracteres,
 * archivoId opcional, cursor antesDe entero positivo. Un sticker (stickerId) va solo,
 * sin texto ni imagen.
 * En sockets también se valida con Zod: los datos del cliente nunca son confiables.
 */
import { z } from 'zod';
import { LIMITE_MAXIMO, LIMITE_POR_DEFECTO } from '../../lib/paginacion.js';
import { esTextoReservado } from '../stickers/stickers.contenido.js';
import { idSticker } from '../stickers/stickers.esquemas.js';

const conversacionId = z.uuid('Conversación inválida');

export const esquemaParamsId = z.object({ id: conversacionId });

export const esquemaAbrir = z.object({ amigoId: z.uuid('Usuario inválido') });

export const esquemaListarMensajes = z.object({
  antesDe: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMO).default(LIMITE_POR_DEFECTO),
});

// ── Sockets ─────────────────────────────────────────

export const esquemaEnviarMensaje = z
  .object({
    conversacionId,
    contenido: z
      .string()
      .trim()
      .max(4000, 'Máximo 4000 caracteres')
      .refine((texto) => !esTextoReservado(texto), 'Ese texto no está permitido')
      .optional(),
    archivoId: z.uuid('Imagen inválida').optional(),
    stickerId: idSticker.optional(),
  })
  .transform((datos) => ({ ...datos, contenido: datos.contenido || undefined }))
  .refine((datos) => datos.contenido || datos.archivoId || datos.stickerId, 'El mensaje está vacío')
  .refine(
    (datos) => !datos.stickerId || (!datos.contenido && !datos.archivoId),
    'El sticker se envía solo',
  );

export const esquemaMensajeLeido = z.object({
  conversacionId,
  mensajeId: z.coerce.number().int().positive(),
});

export const esquemaEscribiendo = z.object({ conversacionId });
