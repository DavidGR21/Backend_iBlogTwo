/**
 * SQL de la tabla comentarios.
 *
 * Un comentario se muestra si no está eliminado o si alguna respuesta suya (a
 * cualquier profundidad) sigue viva: entonces aparece como "Comentario eliminado"
 * para no romper el hilo. totalRespuestas cuenta solo las respuestas que se muestran.
 */
import { pool } from '../../db/pool.js';

const SE_MUESTRA = (alias) => `(
  ${alias}.eliminado_en IS NULL
  OR EXISTS (
    WITH RECURSIVE descendientes AS (
      SELECT h.id, h.eliminado_en FROM comentarios h WHERE h.comentario_padre_id = ${alias}.id
      UNION ALL
      SELECT h.id, h.eliminado_en
        FROM comentarios h JOIN descendientes d ON h.comentario_padre_id = d.id
    )
    SELECT 1 FROM descendientes WHERE eliminado_en IS NULL
  )
)`;

const SELECT_COMENTARIO = `
  SELECT c.id, c.publicacion_id, c.comentario_padre_id, c.autor_id, c.contenido,
         c.eliminado_en, c.creado_en,
         c.creado_en::text AS cursor_fecha,
         to_jsonb(ur) AS autor,
         (SELECT count(*)::int FROM comentarios r
           WHERE r.comentario_padre_id = c.id AND ${SE_MUESTRA('r')}) AS total_respuestas
    FROM comentarios c
    JOIN v_usuarios_resumen ur ON ur.id = c.autor_id`;

export async function crear({ publicacionId, autorId, contenido, comentarioPadreId }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO comentarios (publicacion_id, autor_id, contenido, comentario_padre_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [publicacionId, autorId, contenido, comentarioPadreId ?? null],
  );
  return rows[0];
}

/** Comentario completo (aunque esté eliminado). */
export async function buscarPorId(id, db = pool) {
  const { rows } = await db.query(`${SELECT_COMENTARIO} WHERE c.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Datos mínimos para permisos. */
export async function buscarBasico(id, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id, c.publicacion_id, c.autor_id, c.contenido, c.eliminado_en,
            p.autor_id AS autor_publicacion_id
       FROM comentarios c
       JOIN publicaciones p ON p.id = c.publicacion_id
      WHERE c.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/** Comentarios raíz, más antiguos primero. El cursor es el último que ya se mostró. */
export async function listarRaiz({ publicacionId, cursor, limite }, db = pool) {
  const { rows } = await db.query(
    `${SELECT_COMENTARIO}
      WHERE c.publicacion_id = $1
        AND c.comentario_padre_id IS NULL
        AND ${SE_MUESTRA('c')}
        AND ($2::timestamptz IS NULL OR (c.creado_en, c.id) > ($2::timestamptz, $3::uuid))
      ORDER BY c.creado_en, c.id
      LIMIT $4`,
    [publicacionId, cursor?.[0] ?? null, cursor?.[1] ?? null, limite],
  );
  return rows;
}

export async function listarRespuestas(comentarioPadreId, limite = 200, db = pool) {
  const { rows } = await db.query(
    `${SELECT_COMENTARIO}
      WHERE c.comentario_padre_id = $1 AND ${SE_MUESTRA('c')}
      ORDER BY c.creado_en, c.id
      LIMIT $2`,
    [comentarioPadreId, limite],
  );
  return rows;
}

export async function actualizar(id, contenido, db = pool) {
  await db.query('UPDATE comentarios SET contenido = $2 WHERE id = $1', [id, contenido]);
}

export async function marcarEliminado(id, db = pool) {
  await db.query('UPDATE comentarios SET eliminado_en = now() WHERE id = $1', [id]);
}
