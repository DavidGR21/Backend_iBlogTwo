/**
 * Acceso al bucket de Neon Storage (compatible con S3).
 *
 * El backend nunca recibe los bytes de las imágenes: genera URLs prefirmadas
 * y el navegador sube o descarga directo del bucket.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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

const UNA_HORA_MS = 3600 * 1000;

/**
 * URL temporal para ver un archivo privado.
 *
 * Se firma con la fecha redondeada a la hora en punto y dura 2 horas: así, durante
 * una misma hora, la URL de cada imagen es idéntica y el navegador puede cachearla
 * (con una firma nueva en cada petición, cada respuesta descargaría todo otra vez).
 * Siempre le queda al menos 1 hora de validez.
 */
export function urlParaVer(claveObjeto) {
  const comando = new GetObjectCommand({ Bucket: env.NEON_BUCKET, Key: claveObjeto });
  const inicioHora = new Date(Math.floor(Date.now() / UNA_HORA_MS) * UNA_HORA_MS);
  return getSignedUrl(obtenerCliente(), comando, { expiresIn: 7200, signingDate: inicioHora });
}

/** Tamaño y tipo real del objeto en el bucket, o null si no existe (aún no se subió). */
export async function obtenerMetadatos(claveObjeto) {
  try {
    const respuesta = await obtenerCliente().send(
      new HeadObjectCommand({ Bucket: env.NEON_BUCKET, Key: claveObjeto }),
    );
    return { tamanoBytes: respuesta.ContentLength, tipoMime: respuesta.ContentType };
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return null;
    throw error;
  }
}

export function eliminarObjeto(claveObjeto) {
  return obtenerCliente().send(
    new DeleteObjectCommand({ Bucket: env.NEON_BUCKET, Key: claveObjeto }),
  );
}
