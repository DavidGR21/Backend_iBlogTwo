/**
 * Reglas de mensajería:
 *  - Solo se puede abrir un chat con un amigo (amistades.servicio → sonAmigos).
 *  - clave_directa = '<uuid menor>:<uuid mayor>' evita chats duplicados.
 *  - El contenido se guarda con lib/cifrado (cifrar) y se devuelve descifrado.
 *  - Solo los participantes pueden leer o enviar (la BD también lo exige).
 */
export {};
