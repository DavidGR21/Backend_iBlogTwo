/**
 * Validaciones: búsqueda 1–50 caracteres, página entera (el cursor `antesDe` es el número
 * de la página siguiente, así el frontend reutiliza usePaginado) e id de sticker = slug de KLIPY.
 */
import { z } from 'zod';

export const idSticker = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{0,149}$/i, 'Sticker inválido');

const pagina = z.coerce.number().int().min(1).max(100).default(1);

export const esquemaTendencias = z.object({ antesDe: pagina });

export const esquemaBuscar = z.object({
  q: z.string().trim().min(1, 'Escribe qué buscar').max(50, 'Máximo 50 caracteres'),
  antesDe: pagina,
});
