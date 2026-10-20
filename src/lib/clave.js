/**
 * Contraseñas: se HASHEAN con Argon2id (irreversible), nunca se cifran.
 */
import argon2 from 'argon2';

export function hashearClave(clave) {
  return argon2.hash(clave, { type: argon2.argon2id });
}

export function verificarClave(hashGuardado, claveIngresada) {
  return argon2.verify(hashGuardado, claveIngresada);
}
