/**
 * Repositorio: el ÚNICO lugar del módulo donde se escribe SQL.
 *
 * - Siempre consultas parametrizadas ($1, $2…), nunca concatenar texto.
 * - El último parámetro `db` permite usar la función dentro de una transacción.
 * - Devuelve filas tal cual (snake_case); el mapeador las convierte para la API.
 */
import { pool } from '../../db/pool.js';

export async function buscarPerfilPublico(nombreUsuario, db = pool) {
  const { rows } = await db.query(
    `SELECT u.id, u.nombre_usuario,
            p.nombres, p.apellidos, p.biografia, p.pais_codigo, p.creado_en,
            a.clave_objeto AS foto_perfil_clave
       FROM usuarios u
       JOIN perfiles p ON p.usuario_id = u.id
       LEFT JOIN archivos a ON a.id = p.foto_perfil_id AND a.eliminado_en IS NULL
      WHERE u.nombre_usuario = $1
        AND u.estado = 'activo'
        AND u.correo_verificado_en IS NOT NULL`,
    [nombreUsuario],
  );
  return rows[0] ?? null;
}
