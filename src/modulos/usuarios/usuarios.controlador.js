/**
 * Controlador: traduce HTTP ↔ servicio. Lee req.valido / req.usuario,
 * llama al servicio y responde. Sin SQL y sin reglas de negocio.
 */
import * as servicio from './usuarios.servicio.js';

export async function verPerfilPublico(req, res) {
  const perfil = await servicio.obtenerPerfilPublico(req.valido.params.nombreUsuario);
  res.json(perfil);
}
