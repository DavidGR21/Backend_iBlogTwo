/**
 * SQL de la tabla archivos.
 */
import { pool } from '../../db/pool.js';

export async function crearPendiente(
  { id, propietarioId, bucket, claveObjeto, tipoMime, tamanoBytes },
  db = pool,
) {
  const { rows } = await db.query(
    `INSERT INTO archivos (id, propietario_id, bucket, clave_objeto, tipo_mime, tamano_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, propietarioId, bucket, claveObjeto, tipoMime, tamanoBytes],
  );
  return rows[0];
}

export async function buscarPorId(id, db = pool) {
  const { rows } = await db.query('SELECT * FROM archivos WHERE id = $1 AND eliminado_en IS NULL', [
    id,
  ]);
  return rows[0] ?? null;
}

export async function marcarSubido(id, tamanoBytes, db = pool) {
  const { rows } = await db.query(
    `UPDATE archivos SET estado = 'subido', tamano_bytes = $2
      WHERE id = $1
      RETURNING *`,
    [id, tamanoBytes],
  );
  return rows[0];
}

export async function marcarEliminado(id, db = pool) {
  await db.query('UPDATE archivos SET eliminado_en = now() WHERE id = $1', [id]);
}

/** Ids (de la lista) que son del usuario, ya subidos y no eliminados. */
export async function listarIdsUtilizables(ids, propietarioId, db = pool) {
  const { rows } = await db.query(
    `SELECT id FROM archivos
      WHERE id = ANY($1::uuid[])
        AND propietario_id = $2
        AND estado = 'subido'
        AND eliminado_en IS NULL`,
    [ids, propietarioId],
  );
  return rows.map((fila) => fila.id);
}

/** { id, clave_objeto } de los archivos (de la lista) que aún no se han eliminado. */
export async function listarVigentes(ids, db = pool) {
  const { rows } = await db.query(
    `SELECT id, clave_objeto FROM archivos
      WHERE id = ANY($1::uuid[]) AND eliminado_en IS NULL`,
    [ids],
  );
  return rows;
}

/**
 * Archivos subidos que nada usa: ni una publicación viva, ni un perfil, ni un mensaje.
 * Pasa si el usuario subió imágenes y luego no publicó (o falló la publicación), o con
 * las imágenes de publicaciones borradas antes de que se limpiaran al eliminar.
 * Solo los de más de `horas`, para no tocar una subida que está a punto de enlazarse.
 */
export async function listarSinUsoAntiguos(horas, limite = 100, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id, a.clave_objeto FROM archivos a
      WHERE a.estado = 'subido'
        AND a.eliminado_en IS NULL
        AND a.creado_en < now() - make_interval(hours => $1)
        AND NOT EXISTS (
              SELECT 1 FROM publicacion_archivos pa
                JOIN publicaciones p ON p.id = pa.publicacion_id
               WHERE pa.archivo_id = a.id AND p.eliminado_en IS NULL)
        AND NOT EXISTS (
              SELECT 1 FROM perfiles pf
               WHERE pf.foto_perfil_id = a.id OR pf.foto_portada_id = a.id)
        AND NOT EXISTS (SELECT 1 FROM mensajes m WHERE m.archivo_id = a.id)
      ORDER BY a.creado_en
      LIMIT $2`,
    [horas, limite],
  );
  return rows;
}

/** Subidas que nunca se confirmaron (el usuario cerró la página, falló el PUT…). */
export async function listarPendientesAntiguos(horas, limite = 100, db = pool) {
  const { rows } = await db.query(
    `SELECT id, clave_objeto FROM archivos
      WHERE estado = 'pendiente'
        AND eliminado_en IS NULL
        AND creado_en < now() - make_interval(hours => $1)
      ORDER BY creado_en
      LIMIT $2`,
    [horas, limite],
  );
  return rows;
}
