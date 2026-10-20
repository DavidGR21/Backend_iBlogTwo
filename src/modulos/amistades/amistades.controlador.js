import * as servicio from './amistades.servicio.js';

export async function listarAmigos(req, res) {
  res.json(await servicio.listarAmigos(req.usuario.id));
}

export async function listarSolicitudes(req, res) {
  res.json(await servicio.listarSolicitudes(req.usuario.id, req.valido.query.tipo));
}

export async function enviarSolicitud(req, res) {
  res
    .status(201)
    .json(await servicio.enviarSolicitud(req.usuario.id, req.valido.body.destinatarioId));
}

export async function aceptarSolicitud(req, res) {
  res.json(await servicio.aceptarSolicitud(req.valido.params.id, req.usuario.id));
}

export async function eliminar(req, res) {
  await servicio.eliminar(req.valido.params.id, req.usuario.id);
  res.status(204).end();
}
