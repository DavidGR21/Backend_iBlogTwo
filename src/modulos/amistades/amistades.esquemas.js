/**
 * Validaciones: destinatarioId uuid, tipo de listado recibidas|enviadas.
 */
import { z } from 'zod';

export const esquemaParamsId = z.object({ id: z.uuid('Identificador inválido') });

export const esquemaListarSolicitudes = z.object({
  tipo: z.enum(['recibidas', 'enviadas']).default('recibidas'),
});

export const esquemaEnviarSolicitud = z.object({
  destinatarioId: z.uuid('Usuario inválido'),
});
