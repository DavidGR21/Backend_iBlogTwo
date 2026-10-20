/**
 * Genera llaves aleatorias seguras para el .env (y para Render).
 *   npm run llaves
 *
 * ⚠️ Usa llaves distintas en desarrollo y producción. Si pierdes CLAVE_CIFRADO
 * o CLAVE_HMAC de producción, los datos cifrados ya no se podrán leer.
 */
import crypto from 'node:crypto';

console.log('# Copia estas líneas en tu .env');
console.log(`JWT_SECRETO=${crypto.randomBytes(48).toString('base64url')}`);
console.log(`CLAVE_CIFRADO=${crypto.randomBytes(32).toString('base64')}`);
console.log(`CLAVE_HMAC=${crypto.randomBytes(32).toString('base64')}`);
