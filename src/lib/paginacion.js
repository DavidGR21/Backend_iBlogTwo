/**
 * Paginación por cursor: las listas responden { items, siguienteCursor }.
 *
 * El cursor es opaco para el frontend (lo devuelve tal cual en ?antesDe=).
 * Para fechas se codifica [fecha_en_texto, id] en base64url: así no se pierden
 * los microsegundos de Postgres y dos filas con la misma fecha no se saltan.
 *
 *   const filas = await repo.listar({ cursor: decodificarCursor(antesDe), limite: limite + 1 });
 *   return paginar(filas, limite, (f) => codificarCursor([f.cursor_fecha, f.id]), mapear);
 */
import { z } from 'zod';
import { ErrorApp } from '../errores/ErrorApp.js';

export const LIMITE_POR_DEFECTO = 20;
export const LIMITE_MAXIMO = 50;

/** Esquema Zod reutilizable para ?antesDe&limite. */
export const esquemaPaginacion = z.object({
  antesDe: z.string().min(1).max(500).optional(),
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMO).default(LIMITE_POR_DEFECTO),
});

export function codificarCursor(valores) {
  return Buffer.from(JSON.stringify(valores)).toString('base64url');
}

/** Devuelve [fecha, id] o null si no hay cursor. Lanza 400 si el cursor está mal formado. */
export function decodificarCursor(texto) {
  if (!texto) return null;
  try {
    const valores = JSON.parse(Buffer.from(texto, 'base64url').toString('utf8'));
    if (
      Array.isArray(valores) &&
      valores.length === 2 &&
      valores.every((v) => typeof v === 'string')
    ) {
      return valores;
    }
  } catch {
    // cae al error de abajo
  }
  throw ErrorApp.solicitudInvalida('Cursor de paginación inválido');
}

/**
 * Recibe `limite + 1` filas: si sobra una, hay página siguiente.
 * `mapear` puede ser async (p. ej. para firmar URLs de imágenes).
 */
export async function paginar(filas, limite, obtenerCursor, mapear) {
  const hayMas = filas.length > limite;
  const pagina = hayMas ? filas.slice(0, limite) : filas;
  return {
    items: await Promise.all(pagina.map(mapear)),
    siguienteCursor: hayMas ? obtenerCursor(pagina.at(-1)) : null,
  };
}
