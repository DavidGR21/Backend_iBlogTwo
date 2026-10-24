/**
 * Reglas de archivos. Usa lib/almacenamiento.
 *  - Clave del objeto: '<carpeta>/<uuid>.<ext>' (ej. 'posts/3f2a….webp'); nunca el nombre original.
 *  - Solo el propietario puede confirmar o eliminar.
 *  - Al confirmar se comprueba en el bucket que el objeto exista y no supere 10 MB
 *    (el tamaño que declara el navegador no es confiable).
 *  - Al eliminar: borrar el objeto del bucket y marcar eliminado_en.
 *  - Exporta también `exigirArchivosPropios(ids, usuarioId)`, que usan
 *    publicaciones, perfiles y mensajes antes de enlazar un archivo, y
 *    `eliminarArchivosSinDueno(ids)` para borrar las imágenes de una publicación eliminada.
 *  - limpiarHuerfanos borra cada hora lo que quedó en el bucket sin usar.
 */
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { ErrorApp } from '../../errores/ErrorApp.js';
import {
  eliminarObjeto,
  obtenerMetadatos,
  urlParaSubir,
  urlParaVer,
} from '../../lib/almacenamiento.js';
import { logger } from '../../lib/logger.js';
import * as repositorio from './archivos.repositorio.js';
import { aArchivo } from './archivos.mapeador.js';
import { TAMANO_MAXIMO } from './archivos.esquemas.js';

const CARPETAS = { perfil: 'perfiles', post: 'posts', mensaje: 'mensajes' };
const EXTENSIONES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function solicitarSubida(usuarioId, { tipoMime, tamanoBytes, destino }) {
  const id = crypto.randomUUID();
  const claveObjeto = `${CARPETAS[destino]}/${id}.${EXTENSIONES[tipoMime]}`;

  await repositorio.crearPendiente({
    id,
    propietarioId: usuarioId,
    bucket: env.NEON_BUCKET,
    claveObjeto,
    tipoMime,
    tamanoBytes,
  });

  return { archivoId: id, urlSubida: await urlParaSubir(claveObjeto, tipoMime) };
}

async function buscarPropio(id, usuarioId) {
  const archivo = await repositorio.buscarPorId(id);
  if (!archivo || archivo.propietario_id !== usuarioId) {
    throw ErrorApp.noEncontrado('Archivo no encontrado');
  }
  return archivo;
}

export async function confirmarSubida(id, usuarioId) {
  const archivo = await buscarPropio(id, usuarioId);
  if (archivo.estado === 'subido') {
    return aArchivo(archivo, { url: await urlParaVer(archivo.clave_objeto) });
  }

  const metadatos = await obtenerMetadatos(archivo.clave_objeto);
  if (!metadatos) throw ErrorApp.solicitudInvalida('La imagen todavía no se ha subido');

  if (metadatos.tamanoBytes > TAMANO_MAXIMO) {
    await eliminarObjeto(archivo.clave_objeto);
    await repositorio.marcarEliminado(id);
    throw ErrorApp.solicitudInvalida('La imagen supera los 10 MB');
  }

  const subido = await repositorio.marcarSubido(id, metadatos.tamanoBytes);
  return aArchivo(subido, { url: await urlParaVer(subido.clave_objeto) });
}

export async function eliminarArchivo(id, usuarioId) {
  const archivo = await buscarPropio(id, usuarioId);
  await eliminarObjeto(archivo.clave_objeto);
  await repositorio.marcarEliminado(id);
}

/**
 * Lanza 400 si algún id no es del usuario o aún no está confirmado.
 * Acepta `db` para usarse dentro de una transacción de otro módulo.
 */
export async function exigirArchivosPropios(ids, usuarioId, db) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return;
  const validos = await repositorio.listarIdsUtilizables(unicos, usuarioId, db);
  if (validos.length !== unicos.length) {
    throw ErrorApp.solicitudInvalida('Alguna imagen no existe, no es tuya o no terminó de subirse');
  }
}

/** Borra cada archivo del bucket y lo marca eliminado; devuelve cuántos se borraron. */
async function borrarDelBucket(archivos) {
  let borrados = 0;
  for (const archivo of archivos) {
    try {
      await eliminarObjeto(archivo.clave_objeto);
      await repositorio.marcarEliminado(archivo.id);
      borrados++;
    } catch (err) {
      logger.warn({ err, archivoId: archivo.id }, 'No se pudo borrar un archivo del bucket');
    }
  }
  return borrados;
}

/**
 * Borra archivos sin comprobar el propietario (publicación eliminada, moderación).
 * Nunca lanza: si el bucket falla, lo registra y la limpieza periódica lo reintentará.
 */
export async function eliminarArchivosSinDueno(ids) {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return 0;
  try {
    return await borrarDelBucket(await repositorio.listarVigentes(unicos));
  } catch (err) {
    logger.warn({ err }, 'No se pudieron borrar archivos del bucket');
    return 0;
  }
}

/**
 * Borra del bucket las subidas que nunca se confirmaron y las imágenes que ya nada usa.
 * La llama server.js cada hora (y un administrador puede lanzarla a mano).
 * Devuelve { pendientes, sinUso } con cuántos archivos se borraron de cada tipo.
 */
export async function limpiarHuerfanos(horas = 24) {
  const pendientes = await borrarDelBucket(await repositorio.listarPendientesAntiguos(horas));
  const sinUso = await borrarDelBucket(await repositorio.listarSinUsoAntiguos(horas));
  if (pendientes + sinUso) {
    logger.info(`Limpieza: ${pendientes} subida(s) sin confirmar y ${sinUso} imagen(es) sin uso`);
  }
  return { pendientes, sinUso };
}
