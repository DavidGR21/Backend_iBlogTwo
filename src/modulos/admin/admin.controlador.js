import * as servicio from './admin.servicio.js';

export async function estadisticas(_req, res) {
  res.json(await servicio.obtenerEstadisticas());
}

export async function listarUsuarios(req, res) {
  res.json(await servicio.listarUsuarios(req.valido.query));
}

export async function verUsuario(req, res) {
  res.json(await servicio.obtenerUsuario(req.valido.params.id));
}

export async function suspender(req, res) {
  res.json(await servicio.suspender(req.valido.params.id, req.usuario.id, req.valido.body));
}

export async function reactivar(req, res) {
  res.json(await servicio.reactivar(req.valido.params.id, req.usuario.id));
}

export async function verificarCorreo(req, res) {
  res.json(await servicio.verificarCorreo(req.valido.params.id, req.usuario.id));
}

export async function cerrarSesiones(req, res) {
  res.json(await servicio.cerrarSesiones(req.valido.params.id, req.usuario.id));
}

export async function quitarFoto(req, res) {
  res.json(await servicio.quitarFoto(req.valido.params.id, req.usuario.id));
}

export async function borrarContenido(req, res) {
  res.json(await servicio.borrarContenido(req.valido.params.id, req.usuario.id));
}

export async function listarPublicaciones(req, res) {
  res.json(await servicio.listarPublicaciones(req.valido.query));
}

export async function eliminarPublicacion(req, res) {
  await servicio.eliminarPublicacion(req.valido.params.id, req.usuario.id);
  res.status(204).end();
}

export async function listarComentarios(req, res) {
  res.json(await servicio.listarComentarios(req.valido.query));
}

export async function eliminarComentario(req, res) {
  await servicio.eliminarComentario(req.valido.params.id, req.usuario.id);
  res.status(204).end();
}

export async function listarRegistro(req, res) {
  res.json(await servicio.listarRegistro(req.valido.query));
}

export async function limpiarArchivos(req, res) {
  res.json(await servicio.limpiarArchivos(req.usuario.id));
}
