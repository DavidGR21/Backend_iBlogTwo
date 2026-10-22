import * as servicio from './stickers.servicio.js';

export function estado(_req, res) {
  res.json({ disponible: servicio.disponible() });
}

export async function tendencias(req, res) {
  res.json(await servicio.tendencias(req.usuario.id, req.valido.query));
}

export async function buscar(req, res) {
  res.json(await servicio.buscar(req.usuario.id, req.valido.query));
}
