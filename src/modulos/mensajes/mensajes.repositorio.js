/**
 * SQL de conversaciones, conversacion_participantes y mensajes.
 */
import { pool } from '../../db/pool.js';

// $1 = usuario con sesión. Una fila por conversación 1 a 1 con la otra persona,
// su último mensaje y cuántos mensajes de la otra persona no he leído.
const SELECT_CONVERSACION = `
  SELECT c.id, c.creado_en, c.ultimo_mensaje_en,
         to_jsonb(ur) AS otro_usuario,
         um.contenido_cifrado AS ultimo_contenido_cifrado,
         um.remitente_id      AS ultimo_remitente_id,
         um.creado_en         AS ultimo_creado_en,
         (SELECT count(*)::int FROM mensajes m
           WHERE m.conversacion_id = c.id
             AND m.remitente_id <> $1
             AND m.eliminado_en IS NULL
             AND m.id > COALESCE(yo.ultimo_leido_mensaje_id, 0)) AS no_leidos
    FROM conversacion_participantes yo
    JOIN conversaciones c ON c.id = yo.conversacion_id AND c.clave_directa IS NOT NULL
    JOIN conversacion_participantes otro
      ON otro.conversacion_id = c.id AND otro.usuario_id <> yo.usuario_id
    JOIN v_usuarios_resumen ur ON ur.id = otro.usuario_id
    LEFT JOIN LATERAL (
      SELECT m.contenido_cifrado, m.remitente_id, m.creado_en
        FROM mensajes m
       WHERE m.conversacion_id = c.id AND m.eliminado_en IS NULL
       ORDER BY m.id DESC
       LIMIT 1
    ) um ON true
   WHERE yo.usuario_id = $1`;

const SELECT_MENSAJE = `
  SELECT m.id, m.conversacion_id, m.remitente_id, m.contenido_cifrado, m.creado_en,
         a.clave_objeto AS imagen_clave
    FROM mensajes m
    LEFT JOIN archivos a ON a.id = m.archivo_id AND a.eliminado_en IS NULL`;

export async function listarDeUsuario(usuarioId, db = pool) {
  const { rows } = await db.query(
    `${SELECT_CONVERSACION}
     ORDER BY COALESCE(c.ultimo_mensaje_en, c.creado_en) DESC`,
    [usuarioId],
  );
  return rows;
}

export async function buscarDeUsuario(conversacionId, usuarioId, db = pool) {
  const { rows } = await db.query(`${SELECT_CONVERSACION} AND c.id = $2`, [
    usuarioId,
    conversacionId,
  ]);
  return rows[0] ?? null;
}

/** Crea el chat 1 a 1 si no existe (clave_directa única evita duplicados) y devuelve su id. */
export async function obtenerOCrearDirecta(claveDirecta, participantes, db = pool) {
  await db.query(
    `INSERT INTO conversaciones (clave_directa) VALUES ($1)
     ON CONFLICT (clave_directa) DO NOTHING`,
    [claveDirecta],
  );
  const { rows } = await db.query('SELECT id FROM conversaciones WHERE clave_directa = $1', [
    claveDirecta,
  ]);
  const { id } = rows[0];

  await db.query(
    `INSERT INTO conversacion_participantes (conversacion_id, usuario_id)
     SELECT $1, unnest($2::uuid[])
     ON CONFLICT DO NOTHING`,
    [id, participantes],
  );
  return id;
}

/** Ids de todos los participantes, o [] si el usuario no es uno de ellos. */
export async function listarParticipantes(conversacionId, usuarioId, db = pool) {
  const { rows } = await db.query(
    `SELECT usuario_id FROM conversacion_participantes
      WHERE conversacion_id = $1
        AND EXISTS (SELECT 1 FROM conversacion_participantes
                     WHERE conversacion_id = $1 AND usuario_id = $2)`,
    [conversacionId, usuarioId],
  );
  return rows.map((fila) => fila.usuario_id);
}

export async function crearMensaje(
  { conversacionId, remitenteId, contenidoCifrado, archivoId },
  db = pool,
) {
  const { rows } = await db.query(
    `INSERT INTO mensajes (conversacion_id, remitente_id, contenido_cifrado, archivo_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [conversacionId, remitenteId, contenidoCifrado ?? null, archivoId ?? null],
  );
  return rows[0].id;
}

export async function buscarMensaje(id, db = pool) {
  const { rows } = await db.query(`${SELECT_MENSAJE} WHERE m.id = $1`, [id]);
  return rows[0] ?? null;
}

/** Más recientes primero; antesDe es el id del último mensaje ya mostrado. */
export async function listarMensajes({ conversacionId, antesDe, limite }, db = pool) {
  const { rows } = await db.query(
    `${SELECT_MENSAJE}
      WHERE m.conversacion_id = $1
        AND m.eliminado_en IS NULL
        AND ($2::bigint IS NULL OR m.id < $2::bigint)
      ORDER BY m.id DESC
      LIMIT $3`,
    [conversacionId, antesDe ?? null, limite],
  );
  return rows;
}

/** Solo avanza (nunca retrocede) y solo con un mensaje de esa conversación. */
export async function marcarLeido(conversacionId, usuarioId, mensajeId, db = pool) {
  await db.query(
    `UPDATE conversacion_participantes
        SET ultimo_leido_mensaje_id = $3
      WHERE conversacion_id = $1 AND usuario_id = $2
        AND (ultimo_leido_mensaje_id IS NULL OR ultimo_leido_mensaje_id < $3)
        AND EXISTS (SELECT 1 FROM mensajes WHERE id = $3 AND conversacion_id = $1)`,
    [conversacionId, usuarioId, mensajeId],
  );
}
