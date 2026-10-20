/**
 * Validaciones de archivos. Deben coincidir con los CHECK de la tabla archivos:
 * tipoMime en image/jpeg|png|webp|gif y tamanoBytes ≤ 10 MB.
 */
import { z } from 'zod';

export const TIPOS_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

export const esquemaSolicitarSubida = z.object({
  tipoMime: z.enum(TIPOS_MIME, 'Solo se permiten imágenes JPG, PNG, WEBP o GIF'),
  tamanoBytes: z.number().int().positive().max(TAMANO_MAXIMO, 'La imagen supera los 10 MB'),
  destino: z.enum(['perfil', 'post', 'mensaje']),
});

export const esquemaParamsId = z.object({ id: z.uuid('Identificador inválido') });
