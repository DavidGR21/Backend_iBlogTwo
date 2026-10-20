/**
 * Mapeador: convierte filas de la BD (snake_case) en objetos de la API (camelCase)
 * y decide qué campos se exponen. Nunca devuelvas una fila completa al cliente:
 * así una columna sensible nueva (clave_hash, correo_cifrado…) jamás se filtra.
 */
export function aPerfilPublico(fila, { fotoPerfilUrl = null } = {}) {
  return {
    id: fila.id,
    nombreUsuario: fila.nombre_usuario,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    biografia: fila.biografia,
    pais: fila.pais_codigo,
    fotoPerfilUrl,
    miembroDesde: fila.creado_en,
  };
}
