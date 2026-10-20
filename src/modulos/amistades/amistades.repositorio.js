/**
 * SQL de la tabla amistades y la vista v_amigos.
 * "usuario" en los listados es siempre la otra persona (to_jsonb de v_usuarios_resumen).
 */
import { pool } from '../../db/pool.js';

export async function crearSolicitud(solicitanteId, destinatarioId, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO amistades (solicitante_id, destinatario_id)
     VALUES ($1, $2)
     RETURNING *`,
    [solicitanteId, destinatarioId],
  );
  return rows[0];
}

export async function buscarPorId(id, db = pool) {
  const { rows } = await db.query('SELECT * FROM amistades WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/** La fila del par, en cualquier dirección. */
export async function buscarEntre(usuarioA, usuarioB, db = pool) {
  const { rows } = await db.query(
    `SELECT * FROM amistades
      WHERE (solicitante_id = $1 AND destinatario_id = $2)
         OR (solicitante_id = $2 AND destinatario_id = $1)`,
    [usuarioA, usuarioB],
  );
  return rows[0] ?? null;
}

/** Acepta solo si sigue pendiente y el que acepta es el destinatario. */
export async function aceptar(id, destinatarioId, db = pool) {
  const { rows } = await db.query(
    `UPDATE amistades SET estado = 'aceptada', aceptada_en = now()
      WHERE id = $1 AND destinatario_id = $2 AND estado = 'pendiente'
      RETURNING *`,
    [id, destinatarioId],
  );
  return rows[0] ?? null;
}

/** Borra la fila si el usuario es parte de ella. Devuelve la fila borrada o null. */
export async function eliminar(id, usuarioId, db = pool) {
  const { rows } = await db.query(
    `DELETE FROM amistades
      WHERE id = $1 AND $2 IN (solicitante_id, destinatario_id)
      RETURNING *`,
    [id, usuarioId],
  );
  return rows[0] ?? null;
}

export async function listarAmigos(usuarioId, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id, a.aceptada_en, to_jsonb(ur) AS usuario
       FROM amistades a
       JOIN v_usuarios_resumen ur
         ON ur.id = CASE WHEN a.solicitante_id = $1 THEN a.destinatario_id ELSE a.solicitante_id END
      WHERE a.estado = 'aceptada' AND $1 IN (a.solicitante_id, a.destinatario_id)
      ORDER BY ur.nombres, ur.apellidos NULLS FIRST`,
    [usuarioId],
  );
  return rows;
}

export async function listarSolicitudesRecibidas(usuarioId, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id, a.creado_en, to_jsonb(ur) AS usuario
       FROM amistades a
       JOIN v_usuarios_resumen ur ON ur.id = a.solicitante_id
      WHERE a.estado = 'pendiente' AND a.destinatario_id = $1
      ORDER BY a.creado_en DESC`,
    [usuarioId],
  );
  return rows;
}

export async function listarSolicitudesEnviadas(usuarioId, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id, a.creado_en, to_jsonb(ur) AS usuario
       FROM amistades a
       JOIN v_usuarios_resumen ur ON ur.id = a.destinatario_id
      WHERE a.estado = 'pendiente' AND a.solicitante_id = $1
      ORDER BY a.creado_en DESC`,
    [usuarioId],
  );
  return rows;
}

export async function sonAmigos(usuarioA, usuarioB, db = pool) {
  const { rows } = await db.query(
    'SELECT 1 FROM v_amigos WHERE usuario_id = $1 AND amigo_id = $2 LIMIT 1',
    [usuarioA, usuarioB],
  );
  return rows.length > 0;
}

export async function listarIdsAmigos(usuarioId, db = pool) {
  const { rows } = await db.query('SELECT amigo_id FROM v_amigos WHERE usuario_id = $1', [
    usuarioId,
  ]);
  return rows.map((fila) => fila.amigo_id);
}
