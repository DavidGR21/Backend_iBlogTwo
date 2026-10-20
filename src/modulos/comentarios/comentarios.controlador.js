import * as servicio from './comentarios.servicio.js';

export async function listarDePublicacion(req, res) {
  res.json(await servicio.listarDePublicacion(req.usuario?.id ?? null, req.valido.query));
}

export async function listarRespuestas(req, res) {
  res.json(await servicio.listarRespuestas(req.valido.params.id, req.usuario?.id ?? null));
}

export async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.usuario.id, req.valido.body));
}

export async function editar(req, res) {
  res.json(await servicio.editar(req.valido.params.id, req.usuario.id, req.valido.body.contenido));
}

export async function eliminar(req, res) {
  await servicio.eliminar(req.valido.params.id, req.usuario.id);
  res.status(204).end();
}
