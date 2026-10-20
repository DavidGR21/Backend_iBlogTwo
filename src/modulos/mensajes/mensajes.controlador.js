import * as servicio from './mensajes.servicio.js';

export async function listarConversaciones(req, res) {
  res.json(await servicio.listarConversaciones(req.usuario.id));
}

export async function abrirConversacion(req, res) {
  res.json(await servicio.abrirConversacion(req.usuario.id, req.valido.body.amigoId));
}

export async function listarMensajes(req, res) {
  res.json(await servicio.listarMensajes(req.valido.params.id, req.usuario.id, req.valido.query));
}
