/**
 * Error "esperado" de la aplicación: algo que el cliente hizo mal o que no existe.
 * Los servicios lanzan estos errores y middlewares/manejarErrores.js los
 * convierte en una respuesta JSON con el código HTTP correcto.
 *
 *   throw ErrorApp.noEncontrado('Publicación no encontrada');
 *
 * Cualquier otro error (bug, caída de la BD) se responde como 500 genérico
 * y se registra en el log, sin filtrar detalles internos al cliente.
 */
export class ErrorApp extends Error {
  constructor(estado, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorApp';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }

  static solicitudInvalida(mensaje = 'Solicitud inválida', detalles) {
    return new ErrorApp(400, 'SOLICITUD_INVALIDA', mensaje, detalles);
  }

  static noAutenticado(mensaje = 'Debes iniciar sesión') {
    return new ErrorApp(401, 'NO_AUTENTICADO', mensaje);
  }

  static prohibido(mensaje = 'No tienes permiso para esta acción') {
    return new ErrorApp(403, 'PROHIBIDO', mensaje);
  }

  static noEncontrado(mensaje = 'Recurso no encontrado') {
    return new ErrorApp(404, 'NO_ENCONTRADO', mensaje);
  }

  static conflicto(mensaje = 'El recurso ya existe') {
    return new ErrorApp(409, 'CONFLICTO', mensaje);
  }

  static noDisponible(mensaje = 'Servicio no disponible, intenta más tarde') {
    return new ErrorApp(503, 'NO_DISPONIBLE', mensaje);
  }

  static demasiadasPeticiones(mensaje = 'Demasiados intentos, espera un momento') {
    return new ErrorApp(429, 'DEMASIADAS_PETICIONES', mensaje);
  }
}
