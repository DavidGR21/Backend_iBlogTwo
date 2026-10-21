/**
 * SQL de auth: tablas usuarios, perfiles (al registrarse), tokens_usuario y sesiones.
 */
import { pool } from '../../db/pool.js';

// ── Usuarios ────────────────────────────────────────

export async function crearUsuario(
  { nombreUsuario, correoCifrado, correoHash, claveHash },
  db = pool,
) {
  const { rows } = await db.query(
    `INSERT INTO usuarios (nombre_usuario, correo_cifrado, correo_hash, clave_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [nombreUsuario, correoCifrado, correoHash, claveHash],
  );
  return rows[0];
}

export async function crearPerfil(usuarioId, { nombres, apellidos, paisCodigo }, db = pool) {
  await db.query(
    `INSERT INTO perfiles (usuario_id, nombres, apellidos, pais_codigo)
     VALUES ($1, $2, $3, $4)`,
    [usuarioId, nombres, apellidos ?? null, paisCodigo ?? null],
  );
}

const COLUMNAS_USUARIO = `u.id, u.nombre_usuario, u.clave_hash, u.estado, u.correo_verificado_en,
                          p.nombres`;

export async function buscarPorCorreoHash(correoHash, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_USUARIO}
       FROM usuarios u JOIN perfiles p ON p.usuario_id = u.id
      WHERE u.correo_hash = $1`,
    [correoHash],
  );
  return rows[0] ?? null;
}

/** nombre_usuario es citext: la búsqueda no distingue mayúsculas. */
export async function buscarPorNombreUsuario(nombreUsuario, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_USUARIO}
       FROM usuarios u JOIN perfiles p ON p.usuario_id = u.id
      WHERE u.nombre_usuario = $1`,
    [nombreUsuario],
  );
  return rows[0] ?? null;
}

export async function buscarPorId(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_USUARIO}
       FROM usuarios u JOIN perfiles p ON p.usuario_id = u.id
      WHERE u.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function marcarCorreoVerificado(usuarioId, db = pool) {
  await db.query(
    `UPDATE usuarios SET correo_verificado_en = COALESCE(correo_verificado_en, now())
      WHERE id = $1`,
    [usuarioId],
  );
}

export async function actualizarClave(usuarioId, claveHash, db = pool) {
  await db.query('UPDATE usuarios SET clave_hash = $2 WHERE id = $1', [usuarioId, claveHash]);
}

export async function registrarAcceso(usuarioId, db = pool) {
  await db.query('UPDATE usuarios SET ultimo_acceso_en = now() WHERE id = $1', [usuarioId]);
}

// ── Tokens de un solo uso ───────────────────────────

export async function crearToken({ usuarioId, proposito, tokenHash, minutos }, db = pool) {
  await db.query(
    `INSERT INTO tokens_usuario (usuario_id, proposito, token_hash, expira_en)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [usuarioId, proposito, tokenHash, minutos],
  );
}

/** Invalida los tokens anteriores sin usar (al reenviar un correo, solo vale el último enlace). */
export async function anularTokens(usuarioId, proposito, db = pool) {
  await db.query(
    `UPDATE tokens_usuario SET usado_en = now()
      WHERE usuario_id = $1 AND proposito = $2 AND usado_en IS NULL`,
    [usuarioId, proposito],
  );
}

/**
 * Marca el token como usado en la misma consulta que lo valida: aunque lleguen
 * dos peticiones a la vez con el mismo enlace, solo una lo consume.
 * Devuelve el usuario_id o null si no existe, ya se usó o expiró.
 */
export async function consumirToken(tokenHash, proposito, db = pool) {
  const { rows } = await db.query(
    `UPDATE tokens_usuario SET usado_en = now()
      WHERE token_hash = $1 AND proposito = $2
        AND usado_en IS NULL AND expira_en > now()
      RETURNING usuario_id`,
    [tokenHash, proposito],
  );
  return rows[0]?.usuario_id ?? null;
}

// ── Sesiones (refresh tokens) ───────────────────────

export async function crearSesion({ usuarioId, refreshHash, agenteUsuario, ip, dias }, db = pool) {
  await db.query(
    `INSERT INTO sesiones (usuario_id, refresh_token_hash, agente_usuario, ip, expira_en)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))`,
    [usuarioId, refreshHash, agenteUsuario, ip, dias],
  );
}

/** Revoca la sesión si está vigente y devuelve su usuario_id (rotación atómica). */
export async function revocarSesionVigente(refreshHash, db = pool) {
  const { rows } = await db.query(
    `UPDATE sesiones SET revocado_en = now()
      WHERE refresh_token_hash = $1 AND revocado_en IS NULL AND expira_en > now()
      RETURNING usuario_id`,
    [refreshHash],
  );
  return rows[0]?.usuario_id ?? null;
}

export async function revocarTodasLasSesiones(usuarioId, db = pool) {
  await db.query(
    'UPDATE sesiones SET revocado_en = now() WHERE usuario_id = $1 AND revocado_en IS NULL',
    [usuarioId],
  );
}
