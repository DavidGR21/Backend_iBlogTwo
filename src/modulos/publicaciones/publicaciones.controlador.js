import * as servicio from './publicaciones.servicio.js';

export async function listarFeed(req, res) {
  res.json(await servicio.listarFeed(req.usuario?.id ?? null, req.valido.query));
}

export async function listarDeUsuario(req, res) {
  res.json(
    await servicio.listarDeUsuario(
      req.valido.params.usuarioId,
      req.usuario?.id ?? null,
      req.valido.query,
    ),
  );
}

export async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.usuario.id, req.valido.body));
}

export async function ver(req, res) {
  res.json(await servicio.obtener(req.valido.params.id, req.usuario?.id ?? null));
}

export async function editar(req, res) {
  res.json(await servicio.editar(req.valido.params.id, req.usuario.id, req.valido.body));
}

export async function eliminar(req, res) {
  await servicio.eliminar(req.valido.params.id, req.usuario.id);
  res.status(204).end();
}

export async function reaccionar(req, res) {
  res.json(await servicio.reaccionar(req.valido.params.id, req.usuario.id, req.valido.body.tipo));
}

export async function quitarReaccion(req, res) {
  res.json(await servicio.quitarReaccion(req.valido.params.id, req.usuario.id));
}

export async function listarReacciones(req, res) {
  res.json(
    await servicio.listarReacciones(
      req.valido.params.id,
      req.usuario?.id ?? null,
      req.valido.query,
    ),
  );
}
