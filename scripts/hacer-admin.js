/**
 * Da (o quita) el rol de administrador a una cuenta.
 *
 *   npm run admin -- <nombre_usuario>            → la hace admin
 *   npm run admin -- <nombre_usuario> --quitar   → la vuelve usuario normal
 *
 * Desde la web nadie puede cambiar roles: solo se hace desde la terminal con la
 * DATABASE_URL de la base que corresponda.
 */
import pg from 'pg';

const [nombreUsuario, opcion] = process.argv.slice(2);

if (!process.env.DATABASE_URL) {
  console.error('❌ Falta DATABASE_URL (revisa tu .env)');
  process.exit(1);
}
if (!nombreUsuario) {
  console.error('Uso: npm run admin -- <nombre_usuario> [--quitar]');
  process.exit(1);
}

const rol = opcion === '--quitar' ? 'usuario' : 'admin';
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();

try {
  const { rows } = await cliente.query(
    'UPDATE usuarios SET rol = $2 WHERE nombre_usuario = $1 RETURNING nombre_usuario',
    [nombreUsuario, rol],
  );
  if (rows.length === 0) {
    console.error(`❌ No existe la cuenta "${nombreUsuario}"`);
    process.exitCode = 1;
  } else {
    console.log(`✔ ${rows[0].nombre_usuario} ahora tiene el rol "${rol}"`);
  }
} finally {
  await cliente.end();
}
