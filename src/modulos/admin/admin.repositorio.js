/**
 * SQL del panel de administración: estadísticas, listados de moderación y el registro
 * de acciones (acciones_admin).
 *
 * A diferencia del resto de la API, aquí NO se usa v_usuarios_resumen ni la regla de
 * visibilidad: el administrador ve todo, también lo privado y lo de cuentas suspendidas.
 * Los cambios (suspender, borrar…) no se hacen aquí: el servicio usa los servicios de
 * cada módulo.
 */
import { pool } from '../../db/pool.js';

// Autor completo aunque su cuenta esté suspendida. `u` = usuarios, `pf` = perfiles.
const AUTOR = `jsonb_build_object(
    'id', u.id, 'nombre_usuario', u.nombre_usuario, 'nombres', pf.nombres,
    'apellidos', pf.apellidos, 'estado', u.estado,
    'foto_perfil_clave', (SELECT fa.clave_objeto FROM archivos fa
                           WHERE fa.id = pf.foto_perfil_id AND fa.eliminado_en IS NULL)
  )`;

const CURSOR = (columnaFecha, columnaId, n) =>
  `($${n}::timestamptz IS NULL OR (${columnaFecha}, ${columnaId}) < ($${n}::timestamptz, $${n + 1}::uuid))`;

// ── Estadísticas ────────────────────────────────────

export async function contarTodo(db = pool) {
  const { rows } = await db.query(`
    SELECT
      (SELECT count(*)::int FROM usuarios) AS usuarios_total,
      (SELECT count(*)::int FROM usuarios
        WHERE estado = 'activo' AND correo_verificado_en IS NOT NULL) AS usuarios_activos,
      (SELECT count(*)::int FROM usuarios WHERE estado = 'suspendido') AS usuarios_suspendidos,
      (SELECT count(*)::int FROM usuarios
        WHERE estado = 'activo' AND correo_verificado_en IS NULL) AS usuarios_sin_verificar,
      (SELECT count(*)::int FROM usuarios WHERE rol = 'admin') AS administradores,
      (SELECT count(*)::int FROM usuarios
        WHERE creado_en > now() - interval '7 days') AS usuarios_nuevos_7d,
      (SELECT count(*)::int FROM usuarios
        WHERE ultimo_acceso_en > now() - interval '1 day') AS usuarios_conectados_24h,
      (SELECT count(*)::int FROM publicaciones WHERE eliminado_en IS NULL) AS publicaciones_total,
      (SELECT count(*)::int FROM publicaciones
        WHERE eliminado_en IS NULL AND creado_en > now() - interval '7 days') AS publicaciones_7d,
      (SELECT count(*)::int FROM publicaciones
        WHERE eliminado_en IS NOT NULL) AS publicaciones_eliminadas,
      (SELECT count(*)::int FROM comentarios WHERE eliminado_en IS NULL) AS comentarios_total,
      (SELECT count(*)::int FROM reacciones_publicacion) AS reacciones_total,
      (SELECT count(*)::int FROM mensajes) AS mensajes_total,
      (SELECT count(*)::int FROM conversaciones) AS conversaciones_total,
      (SELECT count(*)::int FROM amistades WHERE estado = 'aceptada') AS amistades_total,
      (SELECT count(*)::int FROM amistades WHERE estado = 'pendiente') AS solicitudes_pendientes,
      (SELECT count(*)::int FROM archivos
        WHERE estado = 'subido' AND eliminado_en IS NULL) AS archivos_total,
      (SELECT COALESCE(sum(tamano_bytes), 0)::bigint FROM archivos
        WHERE estado = 'subido' AND eliminado_en IS NULL) AS archivos_bytes`);
  return rows[0];
}

/** Registros, publicaciones y comentarios por día de los últimos `dias` días (incluye hoy). */
export async function actividadPorDia(dias, db = pool) {
  const { rows } = await db.query(
    `SELECT d::date::text AS dia,
            (SELECT count(*)::int FROM usuarios x
              WHERE x.creado_en >= d AND x.creado_en < d + interval '1 day') AS registros,
            (SELECT count(*)::int FROM publicaciones x
              WHERE x.creado_en >= d AND x.creado_en < d + interval '1 day') AS publicaciones,
            (SELECT count(*)::int FROM comentarios x
              WHERE x.creado_en >= d AND x.creado_en < d + interval '1 day') AS comentarios
       FROM generate_series(date_trunc('day', now()) - make_interval(days => $1 - 1),
                            date_trunc('day', now()), interval '1 day') AS d
      ORDER BY d`,
    [dias],
  );
  return rows;
}

/** Las cuentas con más publicaciones vivas en los últimos 30 días. */
export async function listarMasActivos(limite, db = pool) {
  const { rows } = await db.query(
    `SELECT ${AUTOR} AS usuario, count(*)::int AS publicaciones
       FROM publicaciones p
       JOIN usuarios u  ON u.id = p.autor_id
       JOIN perfiles pf ON pf.usuario_id = u.id
      WHERE p.eliminado_en IS NULL AND p.creado_en > now() - interval '30 days'
      GROUP BY u.id, pf.usuario_id
      ORDER BY publicaciones DESC, u.nombre_usuario
      LIMIT $1`,
    [limite],
  );
  return rows;
}

// ── Usuarios ────────────────────────────────────────

const SELECT_USUARIO = `
  SELECT u.id, u.nombre_usuario, u.correo_cifrado, u.rol, u.estado, u.correo_verificado_en,
         u.ultimo_acceso_en, u.creado_en, u.creado_en::text AS cursor_fecha,
         u.suspendido_en, u.suspendido_por, u.motivo_suspension,
         pf.nombres, pf.apellidos, pf.biografia, pf.pais_codigo,
         (SELECT fa.clave_objeto FROM archivos fa
           WHERE fa.id = pf.foto_perfil_id AND fa.eliminado_en IS NULL) AS foto_perfil_clave,
         (SELECT count(*)::int FROM publicaciones x
           WHERE x.autor_id = u.id AND x.eliminado_en IS NULL) AS total_publicaciones,
         (SELECT count(*)::int FROM comentarios x
           WHERE x.autor_id = u.id AND x.eliminado_en IS NULL) AS total_comentarios
    FROM usuarios u
    JOIN perfiles pf ON pf.usuario_id = u.id`;

/**
 * `patron`: texto ILIKE ya escapado ('%ana%') o null (sin búsqueda).
 * `correoHash`: HMAC del correo si lo buscado parece un correo (siempre junto con `patron`).
 * `filtro`: activos | suspendidos | sin_verificar | admins | null.
 */
export async function listarUsuarios({ patron, correoHash, filtro, cursor, limite }, db = pool) {
  const { rows } = await db.query(
    `${SELECT_USUARIO}
      WHERE ($1::text IS NULL
             OR u.nombre_usuario::text ILIKE $1
             OR (pf.nombres || ' ' || COALESCE(pf.apellidos, '')) ILIKE $1
             OR u.correo_hash = $2::bytea)
        AND ($3::text IS NULL
             OR ($3 = 'activos' AND u.estado = 'activo' AND u.correo_verificado_en IS NOT NULL)
             OR ($3 = 'suspendidos' AND u.estado = 'suspendido')
             OR ($3 = 'sin_verificar' AND u.estado = 'activo' AND u.correo_verificado_en IS NULL)
             OR ($3 = 'admins' AND u.rol = 'admin'))
        AND ${CURSOR('u.creado_en', 'u.id', 4)}
      ORDER BY u.creado_en DESC, u.id DESC
      LIMIT $6`,
    [patron, correoHash, filtro ?? null, cursor?.[0] ?? null, cursor?.[1] ?? null, limite],
  );
  return rows;
}

/** Ficha completa de una cuenta, con algunos totales más que en la lista. */
export async function buscarUsuario(id, db = pool) {
  const { rows } = await db.query(
    `SELECT t.*,
            (SELECT count(*)::int FROM v_amigos va WHERE va.usuario_id = t.id) AS total_amigos,
            (SELECT count(*)::int FROM reacciones_publicacion r
              WHERE r.usuario_id = t.id) AS total_reacciones,
            (SELECT count(*)::int FROM mensajes m WHERE m.remitente_id = t.id) AS total_mensajes,
            (SELECT count(*)::int FROM sesiones s
              WHERE s.usuario_id = t.id AND s.revocado_en IS NULL
                AND s.expira_en > now()) AS sesiones_activas,
            (SELECT x.nombre_usuario FROM usuarios x
              WHERE x.id = t.suspendido_por) AS suspendido_por_nombre
       FROM (${SELECT_USUARIO} WHERE u.id = $1) t`,
    [id],
  );
  return rows[0] ?? null;
}

// ── Publicaciones ───────────────────────────────────

export async function listarPublicaciones({ patron, autorId, estado, cursor, limite }, db = pool) {
  const { rows } = await db.query(
    `SELECT p.id, p.contenido, p.visibilidad, p.creado_en, p.eliminado_en,
            p.creado_en::text AS cursor_fecha,
            (p.actualizado_en > p.creado_en) AS editada,
            ${AUTOR} AS autor,
            (SELECT m.nombre_usuario FROM usuarios m WHERE m.id = p.eliminado_por) AS eliminado_por,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', a.id, 'clave', a.clave_objeto)
                               ORDER BY pa.orden)
                FROM publicacion_archivos pa
                JOIN archivos a ON a.id = pa.archivo_id AND a.eliminado_en IS NULL
               WHERE pa.publicacion_id = p.id
            ), '[]'::jsonb) AS imagenes,
            (SELECT count(*)::int FROM reacciones_publicacion r
              WHERE r.publicacion_id = p.id) AS total_reacciones,
            (SELECT count(*)::int FROM comentarios c
              WHERE c.publicacion_id = p.id AND c.eliminado_en IS NULL) AS total_comentarios
       FROM publicaciones p
       JOIN usuarios u  ON u.id = p.autor_id
       JOIN perfiles pf ON pf.usuario_id = u.id
      WHERE ($1::text IS NULL OR p.contenido ILIKE $1 OR u.nombre_usuario::text ILIKE $1)
        AND ($2::uuid IS NULL OR p.autor_id = $2::uuid)
        AND ($3 = 'todas'
             OR ($3 = 'vivas' AND p.eliminado_en IS NULL)
             OR ($3 = 'eliminadas' AND p.eliminado_en IS NOT NULL))
        AND ${CURSOR('p.creado_en', 'p.id', 4)}
      ORDER BY p.creado_en DESC, p.id DESC
      LIMIT $6`,
    [patron, autorId ?? null, estado, cursor?.[0] ?? null, cursor?.[1] ?? null, limite],
  );
  return rows;
}

// ── Comentarios ─────────────────────────────────────

export async function listarComentarios({ patron, autorId, estado, cursor, limite }, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id, c.publicacion_id, c.comentario_padre_id, c.contenido, c.creado_en,
            c.eliminado_en, c.creado_en::text AS cursor_fecha,
            ${AUTOR} AS autor,
            (SELECT m.nombre_usuario FROM usuarios m WHERE m.id = c.eliminado_por) AS eliminado_por,
            left(pub.contenido, 140) AS publicacion_extracto,
            (pub.eliminado_en IS NOT NULL) AS publicacion_eliminada
       FROM comentarios c
       JOIN publicaciones pub ON pub.id = c.publicacion_id
       JOIN usuarios u  ON u.id = c.autor_id
       JOIN perfiles pf ON pf.usuario_id = u.id
      WHERE ($1::text IS NULL OR c.contenido ILIKE $1 OR u.nombre_usuario::text ILIKE $1)
        AND ($2::uuid IS NULL OR c.autor_id = $2::uuid)
        AND ($3 = 'todas'
             OR ($3 = 'vivas' AND c.eliminado_en IS NULL)
             OR ($3 = 'eliminadas' AND c.eliminado_en IS NOT NULL))
        AND ${CURSOR('c.creado_en', 'c.id', 4)}
      ORDER BY c.creado_en DESC, c.id DESC
      LIMIT $6`,
    [patron, autorId ?? null, estado, cursor?.[0] ?? null, cursor?.[1] ?? null, limite],
  );
  return rows;
}

// ── Registro de acciones ────────────────────────────

export async function registrarAccion(
  { adminId, accion, objetivoTipo, objetivoId, detalle },
  db = pool,
) {
  await db.query(
    `INSERT INTO acciones_admin (admin_id, accion, objetivo_tipo, objetivo_id, detalle)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, accion, objetivoTipo, objetivoId ?? null, detalle?.slice(0, 500) ?? null],
  );
}

export async function listarAcciones({ cursor, limite }, db = pool) {
  const { rows } = await db.query(
    `SELECT r.id, r.accion, r.objetivo_tipo, r.objetivo_id, r.detalle, r.creado_en,
            r.creado_en::text AS cursor_fecha,
            u.nombre_usuario AS admin_nombre_usuario
       FROM acciones_admin r
       LEFT JOIN usuarios u ON u.id = r.admin_id
      WHERE ${CURSOR('r.creado_en', 'r.id', 1)}
      ORDER BY r.creado_en DESC, r.id DESC
      LIMIT $3`,
    [cursor?.[0] ?? null, cursor?.[1] ?? null, limite],
  );
  return rows;
}

export async function buscarNombreUsuario(id, db = pool) {
  const { rows } = await db.query('SELECT nombre_usuario FROM usuarios WHERE id = $1', [id]);
  return rows[0]?.nombre_usuario ?? null;
}
