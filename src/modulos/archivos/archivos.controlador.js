import * as servicio from './archivos.servicio.js';

export async function solicitarSubida(req, res) {
  res.status(201).json(await servicio.solicitarSubida(req.usuario.id, req.valido.body));
}

export async function confirmarSubida(req, res) {
  res.json(await servicio.confirmarSubida(req.valido.params.id, req.usuario.id));
}

export async function eliminar(req, res) {
  await servicio.eliminarArchivo(req.valido.params.id, req.usuario.id);
  res.status(204).end();
}
