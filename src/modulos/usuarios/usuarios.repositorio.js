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

/** Cuenta completa del usuario con sesión (incluye datos cifrados para descifrar). */
export async function buscarCuenta(usuarioId, db = pool) {
  const { rows } = await db.query(
    `SELECT u.id, u.nombre_usuario, u.correo_cifrado,
            p.nombres, p.apellidos, p.biografia, p.pais_codigo, p.telefono_cifrado,
            p.fecha_nacimiento::text AS fecha_nacimiento,
            p.foto_perfil_id,
            a.clave_objeto AS foto_perfil_clave
       FROM usuarios u
       JOIN perfiles p ON p.usuario_id = u.id
       LEFT JOIN archivos a ON a.id = p.foto_perfil_id AND a.eliminado_en IS NULL
      WHERE u.id = $1`,
    [usuarioId],
  );
  return rows[0] ?? null;
}

/** Fila para UsuarioResumen (solo cuentas activas y verificadas). */
export async function buscarResumen(usuarioId, db = pool) {
  const { rows } = await db.query('SELECT * FROM v_usuarios_resumen WHERE id = $1', [usuarioId]);
  return rows[0] ?? null;
}

// Lista blanca: nombre del campo en el servicio → columna de perfiles.
const COLUMNAS_PERFIL = {
  nombres: 'nombres',
  apellidos: 'apellidos',
  biografia: 'biografia',
  paisCodigo: 'pais_codigo',
  telefonoCifrado: 'telefono_cifrado',
  fechaNacimiento: 'fecha_nacimiento',
  fotoPerfilId: 'foto_perfil_id',
};

/** Actualiza solo los campos presentes en `cambios` (las columnas salen de la lista blanca). */
export async function actualizarPerfil(usuarioId, cambios, db = pool) {
  // undefined = "no tocar"; null sí se guarda (borra el dato).
  const campos = Object.keys(cambios).filter(
    (campo) => campo in COLUMNAS_PERFIL && cambios[campo] !== undefined,
  );
  if (campos.length === 0) return;

  const asignaciones = campos.map((campo, i) => `${COLUMNAS_PERFIL[campo]} = $${i + 2}`);
  await db.query(`UPDATE perfiles SET ${asignaciones.join(', ')} WHERE usuario_id = $1`, [
    usuarioId,
    ...campos.map((campo) => cambios[campo]),
  ]);
}
