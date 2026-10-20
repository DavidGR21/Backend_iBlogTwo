/**
 * Aplica, en orden, los archivos de db/migraciones/ que aún no se hayan aplicado.
 * Lleva el registro en la tabla migraciones_aplicadas.
 *
 *   npm run migrar
 *
 * Reglas:
 *  - Nunca edites una migración ya aplicada: crea una nueva (002_…, 003_…).
 *  - Cada archivo corre dentro de una transacción: si falla, no queda a medias.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const CARPETA = path.resolve(import.meta.dirname, '../db/migraciones');

if (!process.env.DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL (revisa tu .env)');
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();

try {
  await cliente.query(`
    CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
      nombre      text        PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);

  const { rows } = await cliente.query('SELECT nombre FROM migraciones_aplicadas');
  const aplicadas = new Set(rows.map((fila) => fila.nombre));

  const archivos = (await fs.readdir(CARPETA)).filter((f) => f.endsWith('.sql')).sort();
  let nuevas = 0;

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await fs.readFile(path.join(CARPETA, archivo), 'utf8');
    console.log(`→ Aplicando ${archivo}`);
    await cliente.query('BEGIN');
    try {
      await cliente.query(sql);
      await cliente.query('INSERT INTO migraciones_aplicadas (nombre) VALUES ($1)', [archivo]);
      await cliente.query('COMMIT');
      nuevas++;
    } catch (error) {
      await cliente.query('ROLLBACK');
      console.error(`❌ Falló ${archivo}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    console.log(nuevas ? `✔ ${nuevas} migración(es) aplicada(s)` : '✔ La base ya está al día');
  }
} finally {
  await cliente.end();
}
