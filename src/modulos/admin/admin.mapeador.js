/**
 * Filas del panel de administración → objetos de la API.
 * `autor` / `usuario` e `imagenes` llegan ya armados (con URLs firmadas) desde el servicio.
 * El administrador sí ve el correo (descifrado), pero nunca el teléfono ni la clave.
 */
import { descifrar } from '../../lib/cifrado.js';
import { separarContenido } from '../stickers/stickers.contenido.js';

export function aEstadisticas(conteos, actividad, masActivos) {
  return {
    usuarios: {
      total: conteos.usuarios_total,
      activos: conteos.usuarios_activos,
      suspendidos: conteos.usuarios_suspendidos,
      sinVerificar: conteos.usuarios_sin_verificar,
      administradores: conteos.administradores,
      nuevos7d: conteos.usuarios_nuevos_7d,
      conectados24h: conteos.usuarios_conectados_24h,
    },
    publicaciones: {
      total: conteos.publicaciones_total,
      ultimos7d: conteos.publicaciones_7d,
      eliminadas: conteos.publicaciones_eliminadas,
    },
    comentarios: conteos.comentarios_total,
    reacciones: conteos.reacciones_total,
    mensajes: conteos.mensajes_total,
    conversaciones: conteos.conversaciones_total,
    amistades: conteos.amistades_total,
    solicitudesPendientes: conteos.solicitudes_pendientes,
    archivos: { total: conteos.archivos_total, bytes: Number(conteos.archivos_bytes) },
    actividad: actividad.map((fila) => ({
      dia: fila.dia,
      registros: fila.registros,
      publicaciones: fila.publicaciones,
      comentarios: fila.comentarios,
    })),
    masActivos,
  };
}

export function aUsuarioAdmin(fila, { fotoPerfilUrl }) {
  return {
    id: fila.id,
    nombreUsuario: fila.nombre_usuario,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    correo: descifrar(fila.correo_cifrado),
    fotoPerfilUrl,
    rol: fila.rol,
    estado: fila.estado,
    correoVerificado: fila.correo_verificado_en !== null,
    creadoEn: fila.creado_en,
    ultimoAccesoEn: fila.ultimo_acceso_en,
    suspendidoEn: fila.suspendido_en,
    motivoSuspension: fila.motivo_suspension,
    totalPublicaciones: fila.total_publicaciones,
    totalComentarios: fila.total_comentarios,
  };
}

/** Ficha completa: lo de la lista + biografía, país y más totales. */
export function aUsuarioAdminDetalle(fila, extras) {
  return {
    ...aUsuarioAdmin(fila, extras),
    biografia: fila.biografia,
    pais: fila.pais_codigo,
    suspendidoPor: fila.suspendido_por_nombre,
    totalAmigos: fila.total_amigos,
    totalReacciones: fila.total_reacciones,
    totalMensajes: fila.total_mensajes,
    sesionesActivas: fila.sesiones_activas,
  };
}

export function aPublicacionAdmin(fila, { autor, imagenes }) {
  return {
    id: fila.id,
    autor,
    contenido: fila.contenido,
    visibilidad: fila.visibilidad,
    imagenes,
    totalReacciones: fila.total_reacciones,
    totalComentarios: fila.total_comentarios,
    editada: Boolean(fila.editada),
    creadaEn: fila.creado_en,
    eliminadaEn: fila.eliminado_en,
    eliminadaPor: fila.eliminado_por,
  };
}

export function aComentarioAdmin(fila, { autor }) {
  const { contenido, sticker } = separarContenido(fila.contenido);
  return {
    id: fila.id,
    publicacionId: fila.publicacion_id,
    comentarioPadreId: fila.comentario_padre_id,
    autor,
    contenido,
    sticker,
    creadoEn: fila.creado_en,
    eliminadoEn: fila.eliminado_en,
    eliminadoPor: fila.eliminado_por,
    publicacionExtracto: fila.publicacion_extracto,
    publicacionEliminada: fila.publicacion_eliminada,
  };
}

export function aAccion(fila) {
  return {
    id: fila.id,
    accion: fila.accion,
    objetivoTipo: fila.objetivo_tipo,
    objetivoId: fila.objetivo_id,
    detalle: fila.detalle,
    admin: fila.admin_nombre_usuario,
    creadaEn: fila.creado_en,
  };
}
