/**
 * Mapeador: convierte filas de la BD (snake_case) en objetos de la API (camelCase)
 * y decide qué campos se exponen. Nunca devuelvas una fila completa al cliente:
 * así una columna sensible nueva (clave_hash, correo_cifrado…) jamás se filtra.
 */
import { descifrar } from '../../lib/cifrado.js';

export function aPerfilPublico(fila, { fotoPerfilUrl = null, amistad = null } = {}) {
  return {
    id: fila.id,
    nombreUsuario: fila.nombre_usuario,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    biografia: fila.biografia,
    pais: fila.pais_codigo,
    fotoPerfilUrl,
    miembroDesde: fila.creado_en,
    amistad,
  };
}

/** UsuarioYo: la cuenta del usuario con sesión, con correo y teléfono descifrados. */
export function aUsuarioYo(fila, { fotoPerfilUrl = null } = {}) {
  return {
    id: fila.id,
    nombreUsuario: fila.nombre_usuario,
    correo: descifrar(fila.correo_cifrado),
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    biografia: fila.biografia,
    pais: fila.pais_codigo,
    telefono: fila.telefono_cifrado ? descifrar(fila.telefono_cifrado) : null,
    fechaNacimiento: fila.fecha_nacimiento,
    fotoPerfilUrl,
    fotoPerfilId: fila.foto_perfil_id,
    rol: fila.rol,
  };
}

/** UsuarioResumen: fila de v_usuarios_resumen (o su to_jsonb). */
export function aUsuarioResumen(fila, { fotoPerfilUrl = null } = {}) {
  return {
    id: fila.id,
    nombreUsuario: fila.nombre_usuario,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    fotoPerfilUrl,
  };
}
