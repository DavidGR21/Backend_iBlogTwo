/**
 * Convierte filas en:
 *  - Mensaje:      { id, conversacionId, remitenteId, contenido (descifrado), sticker, imagenUrl, creadoEn }
 *  - Conversacion: { id, otroUsuario, ultimoMensaje: { contenido, sticker, remitenteId, creadoEn } | null,
 *                    noLeidos }
 * Si el mensaje es un sticker: contenido = null y sticker = { id, titulo, url, ancho, alto }.
 * Mensajes.id es bigint (llega como texto desde pg): se expone como número.
 */
import { descifrar } from '../../lib/cifrado.js';
import { separarContenido } from '../stickers/stickers.contenido.js';

const textoDe = (cifrado) => separarContenido(cifrado ? descifrar(cifrado) : null);

export function aMensaje(fila, { imagenUrl = null } = {}) {
  return {
    id: Number(fila.id),
    conversacionId: fila.conversacion_id,
    remitenteId: fila.remitente_id,
    ...textoDe(fila.contenido_cifrado),
    imagenUrl,
    creadoEn: fila.creado_en,
  };
}

export function aConversacion(fila, { otroUsuario }) {
  return {
    id: fila.id,
    otroUsuario,
    ultimoMensaje: fila.ultimo_creado_en
      ? {
          ...textoDe(fila.ultimo_contenido_cifrado),
          remitenteId: fila.ultimo_remitente_id,
          creadoEn: fila.ultimo_creado_en,
        }
      : null,
    noLeidos: fila.no_leidos ?? 0,
  };
}
