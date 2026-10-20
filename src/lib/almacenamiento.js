/**
 * Acceso al bucket de Neon Storage (compatible con S3).
 *
 * El backend nunca recibe los bytes de las imágenes: genera URLs prefirmadas
 * y el navegador sube o descarga directo del bucket.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

let cliente = null;

function obtenerCliente() {
  if (cliente) return cliente;
  if (!env.AWS_ENDPOINT_URL_S3 || !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Almacenamiento no configurado: completa las variables AWS_* del .env');
  }
  cliente = new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL_S3,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return cliente;
}

/** URL para que el navegador haga PUT del archivo directamente al bucket. */
export function urlParaSubir(claveObjeto, tipoMime, segundos = 300) {
  const comando = new PutObjectCommand({
    Bucket: env.NEON_BUCKET,
    Key: claveObjeto,
    ContentType: tipoMime,
  });
  return getSignedUrl(obtenerCliente(), comando, { expiresIn: segundos });
}

/** URL temporal para ver un archivo privado. */
export function urlParaVer(claveObjeto, segundos = 3600) {
  const comando = new GetObjectCommand({ Bucket: env.NEON_BUCKET, Key: claveObjeto });
  return getSignedUrl(obtenerCliente(), comando, { expiresIn: segundos });
}

export function eliminarObjeto(claveObjeto) {
  return obtenerCliente().send(
    new DeleteObjectCommand({ Bucket: env.NEON_BUCKET, Key: claveObjeto }),
  );
}
