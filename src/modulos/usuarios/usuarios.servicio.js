/**
 * Servicio: reglas de negocio del módulo. No sabe nada de HTTP (ni req ni res),
 * así se puede reutilizar desde rutas, sockets o pruebas.
 */
import { ErrorApp } from '../../errores/ErrorApp.js';
import { urlParaVer } from '../../lib/almacenamiento.js';
import * as repositorio from './usuarios.repositorio.js';
import { aPerfilPublico } from './usuarios.mapeador.js';

export async function obtenerPerfilPublico(nombreUsuario) {
  const fila = await repositorio.buscarPerfilPublico(nombreUsuario);
  if (!fila) throw ErrorApp.noEncontrado('Usuario no encontrado');

  const fotoPerfilUrl = fila.foto_perfil_clave ? await urlParaVer(fila.foto_perfil_clave) : null;
  return aPerfilPublico(fila, { fotoPerfilUrl });
}
