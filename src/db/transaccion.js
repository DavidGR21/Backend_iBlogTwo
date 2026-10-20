/**
 * Ejecuta varias consultas como una sola unidad: o se guardan todas o ninguna.
 *
 * Uso desde un servicio:
 *   await enTransaccion(async (db) => {
 *     const usuario = await usuariosRepo.crear(datos, db);
 *     await perfilesRepo.crear(usuario.id, perfil, db);
 *   });
 *
 * Por eso cada función de repositorio recibe `db` como último parámetro
 * (por defecto el pool): así funciona dentro y fuera de una transacción.
 */
import { pool } from './pool.js';

export async function enTransaccion(trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
