/**
 * Validaciones del panel de administración.
 */
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion.js';

const buscar = z.string().trim().max(100, 'Máximo 100 caracteres').optional();

export const esquemaParamsId = z.object({ id: z.uuid('Identificador inválido') });

export const esquemaListarUsuarios = esquemaPaginacion.extend({
  buscar,
  filtro: z
    .enum(['activos', 'suspendidos', 'sin_verificar', 'admins'], 'Filtro inválido')
    .optional(),
});

export const esquemaListarContenido = esquemaPaginacion.extend({
  buscar,
  autorId: z.uuid('Autor inválido').optional(),
  estado: z.enum(['vivas', 'eliminadas', 'todas'], 'Estado inválido').default('vivas'),
});

export const esquemaListarRegistro = esquemaPaginacion;

export const esquemaSuspender = z.object({
  motivo: z
    .string()
    .trim()
    .max(300, 'Máximo 300 caracteres')
    .optional()
    .transform((motivo) => motivo || null),
  // Además de suspender, borrar todas sus publicaciones y comentarios
  borrarContenido: z.boolean().default(false),
});
