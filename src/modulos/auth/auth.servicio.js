/**
 * Reglas de negocio de auth. Usa lib/cifrado (correo), lib/clave (Argon2),
 * lib/tokens y lib/correo.
 *
 * Reglas clave:
 *  - Registro en una transacción: usuarios + perfiles + tokens_usuario.
 *  - Login busca por hmac(normalizarCorreo(correo)) y exige correo verificado.
 *  - Mensaje de error genérico en login ("correo o clave incorrectos").
 *  - "Olvidé mi clave" responde igual exista o no el correo (no revelar cuentas).
 *  - Los tokens se marcan como usados (usado_en) y se rechazan si expiraron.
 */
export {};
