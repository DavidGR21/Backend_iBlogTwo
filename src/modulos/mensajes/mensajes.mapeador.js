/**
 * Convierte filas en:
 *  - Mensaje:      { id, conversacionId, remitenteId, contenido (descifrado), imagenUrl, creadoEn }
 *  - Conversacion: { id, otroUsuario, ultimoMensaje: { contenido, remitenteId, creadoEn } | null, noLeidos }
 * Mensajes.id es bigint (llega como texto desde pg): se expone como número.
 */
import { descifrar } from '../../lib/cifrado.js';

const textoDe = (cifrado) => (cifrado ? descifrar(cifrado) : null);

export function aMensaje(fila, { imagenUrl = null } = {}) {
  return {
    id: Number(fila.id),
    conversacionId: fila.conversacion_id,
    remitenteId: fila.remitente_id,
    contenido: textoDe(fila.contenido_cifrado),
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
          contenido: textoDe(fila.ultimo_contenido_cifrado),
          remitenteId: fila.ultimo_remitente_id,
          creadoEn: fila.ultimo_creado_en,
        }
      : null,
    noLeidos: fila.no_leidos ?? 0,
  };
}
