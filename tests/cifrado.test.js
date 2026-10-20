/**
 * Prueba unitaria de ejemplo con el runner nativo de Node:  npm test
 * Convención: un archivo <algo>.test.js por cada pieza a probar.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, descifrar, hmac, normalizarCorreo } from '../src/lib/cifrado.js';

test('cifrar y descifrar devuelven el texto original', () => {
  const original = 'david@ejemplo.com';
  assert.equal(descifrar(cifrar(original)), original);
});

test('el mismo texto produce cifrados distintos (IV aleatorio)', () => {
  assert.notDeepEqual(cifrar('hola'), cifrar('hola'));
});

test('el hmac es determinista y no depende de mayúsculas tras normalizar', () => {
  assert.deepEqual(
    hmac(normalizarCorreo(' Ana@Gmail.com ')),
    hmac(normalizarCorreo('ana@gmail.com')),
  );
});

test('un dato alterado no se puede descifrar', () => {
  const cifrado = cifrar('secreto');
  cifrado[cifrado.length - 1] ^= 1;
  assert.throws(() => descifrar(cifrado));
});
