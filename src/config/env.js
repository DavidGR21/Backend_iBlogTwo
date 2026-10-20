/**
 * Única puerta de entrada a las variables de entorno.
 *
 * Regla: ningún otro archivo lee process.env directamente; todos importan `env`.
 * Si falta o está mal una variable, el servidor se detiene al arrancar con un
 * mensaje claro, en lugar de fallar más tarde en medio de una petición.
 */
import { z } from 'zod';

const llave32Bytes = z.string().refine((valor) => Buffer.from(valor, 'base64').length === 32, {
  message: 'Debe ser una llave de 32 bytes en base64 (genérala con: npm run llaves)',
});

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'Falta la cadena de conexión de Neon'),
  FRONTEND_URL: z.string().min(1),

  JWT_SECRETO: z.string().min(32, 'Debe tener al menos 32 caracteres'),
  CLAVE_CIFRADO: llave32Bytes,
  CLAVE_HMAC: llave32Bytes,

  NEON_BUCKET: z.string().min(1),
  AWS_ENDPOINT_URL_S3: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-2'),

  BREVO_API_KEY: z.string().optional(),
  CORREO_REMITENTE_NOMBRE: z.string().default('iBlog'),
  CORREO_REMITENTE_EMAIL: z.string().optional(),
});

// Las variables vacías del .env ("CLAVE=") se tratan como no definidas.
const entrada = Object.fromEntries(Object.entries(process.env).filter(([, valor]) => valor !== ''));

const resultado = esquema.safeParse(entrada);

if (!resultado.success) {
  console.error('\n❌ Variables de entorno inválidas:');
  for (const problema of resultado.error.issues) {
    console.error(`   - ${problema.path.join('.')}: ${problema.message}`);
  }
  console.error('\nRevisa tu archivo .env (usa .env.example como guía).\n');
  process.exit(1);
}

export const env = Object.freeze(resultado.data);
export const esProduccion = env.NODE_ENV === 'production';

/**
 * Orígenes permitidos por CORS (Express y Socket.io). FRONTEND_URL admite varios
 * separados por coma, p. ej. el dominio de Vercel y sus previews.
 * La primera es la que se usa en los enlaces de los correos.
 */
export const origenesPermitidos = env.FRONTEND_URL.split(',')
  .map((origen) => origen.trim().replace(/\/$/, ''))
  .filter(Boolean);
export const urlFrontend = origenesPermitidos[0];
