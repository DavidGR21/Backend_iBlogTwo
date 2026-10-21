/**
 * SQL de publicaciones, publicacion_archivos, reacciones_publicacion y v_conteo_reacciones.
 *
 * Todas las lecturas reciben `visitanteId` (uuid o null para invitados) y aplican
 * la regla de visibilidad en SQL:
 *   publico → todos · amigos → el autor y sus amigos · privado → solo el autor
 */
import { pool } from '../../db/pool.js';

// $1 siempre es el visitante (puede ser NULL).
const PUEDE_VER = `
  p.eliminado_en IS NULL AND (
    p.visibilidad = 'publico'
    OR p.autor_id = $1::uuid
    OR (p.visibilidad = 'amigos' AND EXISTS (
          SELECT 1 FROM v_amigos va WHERE va.usuario_id = $1::uuid AND va.amigo_id = p.autor_id))
  )`;

// Una fila trae todo lo que necesita el mapeador: autor, imágenes, conteos y mi reacción.
const SELECT_PUBLICACION = `
  SELECT p.id, p.autor_id, p.contenido, p.visibilidad, p.creado_en,
         p.creado_en::text AS cursor_fecha,
         (p.actualizado_en > p.creado_en) AS editada,
         to_jsonb(ur) AS autor,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('id', a.id, 'clave', a.clave_objeto) ORDER BY pa.orden)
             FROM publicacion_archivos pa
             JOIN archivos a ON a.id = pa.archivo_id AND a.eliminado_en IS NULL
            WHERE pa.publicacion_id = p.id
         ), '[]'::jsonb) AS imagenes,
         COALESCE((
           SELECT jsonb_object_agg(r.tipo, r.total)
             FROM v_conteo_reacciones r WHERE r.publicacion_id = p.id
         ), '{}'::jsonb) AS reacciones,
         (SELECT rp.tipo FROM reacciones_publicacion rp
           WHERE rp.publicacion_id = p.id AND rp.usuario_id = $1::uuid) AS mi_reaccion,
         (SELECT count(*)::int FROM comentarios c
           WHERE c.publicacion_id = p.id AND c.eliminado_en IS NULL) AS total_comentarios
    FROM publicaciones p
    JOIN v_usuarios_resumen ur ON ur.id = p.autor_id`;

const CURSOR = `($2::timestamptz IS NULL OR (p.creado_en, p.id) < ($2::timestamptz, $3::uuid))`;

export async function crear({ autorId, contenido, visibilidad }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO publicaciones (autor_id, contenido, visibilidad)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [autorId, contenido, visibilidad],
  );
  return rows[0];
}

export async function enlazarArchivos(publicacionId, archivoIds, db = pool) {
  if (archivoIds.length === 0) return;
  await db.query(
    `INSERT INTO publicacion_archivos (publicacion_id, archivo_id, orden)
     SELECT $1, archivo_id, (orden - 1)::smallint
       FROM unnest($2::uuid[]) WITH ORDINALITY AS t(archivo_id, orden)`,
    [publicacionId, archivoIds],
  );
}

/** Publicación completa si el visitante puede verla; si no, null. */
export async function listarArchivoIds(publicacionId, db = pool) {
  const { rows } = await db.query(
    'SELECT archivo_id FROM publicacion_archivos WHERE publicacion_id = $1 ORDER BY orden',
    [publicacionId],
  );
  return rows.map((fila) => fila.archivo_id);
}

export async function desenlazarArchivos(publicacionId, db = pool) {
  await db.query('DELETE FROM publicacion_archivos WHERE publicacion_id = $1', [publicacionId]);
}

export async function buscarVisible(id, visitanteId, db = pool) {
  const { rows } = await db.query(`${SELECT_PUBLICACION} WHERE p.id = $2 AND ${PUEDE_VER}`, [
    visitanteId,
    id,
  ]);
  return rows[0] ?? null;
}

/** Datos mínimos para permisos (sin aplicar visibilidad). */
export async function buscarBasica(id, db = pool) {
  const { rows } = await db.query(
    'SELECT id, autor_id, visibilidad FROM publicaciones WHERE id = $1 AND eliminado_en IS NULL',
    [id],
  );
  return rows[0] ?? null;
}

export async function puedeVer(id, visitanteId, db = pool) {
  const { rows } = await db.query(
    `SELECT 1 FROM publicaciones p WHERE p.id = $2 AND ${PUEDE_VER}`,
    [visitanteId, id],
  );
  return rows.length > 0;
}

/** Feed: todo lo que el visitante puede ver, más reciente primero. */
export async function listarFeed({ visitanteId, cursor, limite }, db = pool) {
  const { rows } = await db.query(
    `${SELECT_PUBLICACION}
      WHERE ${PUEDE_VER} AND ${CURSOR}
      ORDER BY p.creado_en DESC, p.id DESC
      LIMIT $4`,
    [visitanteId, cursor?.[0] ?? null, cursor?.[1] ?? null, limite],
  );
  return rows;
}

export async function listarDeAutor({ autorId, visitanteId, cursor, limite }, db = pool) {
  const { rows } = await db.query(
    `${SELECT_PUBLICACION}
      WHERE p.autor_id = $5 AND ${PUEDE_VER} AND ${CURSOR}
      ORDER BY p.creado_en DESC, p.id DESC
      LIMIT $4`,
    [visitanteId, cursor?.[0] ?? null, cursor?.[1] ?? null, limite, autorId],
  );
  return rows;
}

export async function actualizar(id, { contenido, visibilidad }, db = pool) {
  await db.query(
    `UPDATE publicaciones
        SET contenido = COALESCE($2, contenido),
            visibilidad = COALESCE($3::visibilidad_publicacion, visibilidad)
      WHERE id = $1`,
    [id, contenido ?? null, visibilidad ?? null],
  );
}

export async function marcarEliminada(id, db = pool) {
  await db.query('UPDATE publicaciones SET eliminado_en = now() WHERE id = $1', [id]);
}

export async function guardarReaccion(publicacionId, usuarioId, tipo, db = pool) {
  await db.query(
    `INSERT INTO reacciones_publicacion (publicacion_id, usuario_id, tipo)
     VALUES ($1, $2, $3)
     ON CONFLICT (publicacion_id, usuario_id) DO UPDATE SET tipo = EXCLUDED.tipo
     WHERE reacciones_publicacion.tipo <> EXCLUDED.tipo`,
    [publicacionId, usuarioId, tipo],
  );
}

export async function borrarReaccion(publicacionId, usuarioId, db = pool) {
  await db.query(
    'DELETE FROM reacciones_publicacion WHERE publicacion_id = $1 AND usuario_id = $2',
    [publicacionId, usuarioId],
  );
}

/** { me_gusta: 3, me_encanta: 1 } (solo tipos con total > 0). */
export async function contarReacciones(publicacionId, db = pool) {
  const { rows } = await db.query(
    'SELECT tipo, total FROM v_conteo_reacciones WHERE publicacion_id = $1',
    [publicacionId],
  );
  return Object.fromEntries(rows.map((fila) => [fila.tipo, fila.total]));
}
