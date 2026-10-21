/**
 * Controlador de auth: lee req.valido, llama al servicio y responde.
 * Aquí se escribe/borra la cookie del refresh token (httpOnly, secure, sameSite).
 *
 * En producción el frontend (Vercel) y el backend (Render) son dominios distintos:
 * la cookie necesita sameSite 'none' + secure. En localhost basta 'lax'.
 */
import { esProduccion } from '../../config/env.js';
import * as servicio from './auth.servicio.js';

const COOKIE_REFRESH = 'iblog_refresh';

const opcionesCookie = {
  httpOnly: true,
  secure: esProduccion,
  sameSite: esProduccion ? 'none' : 'lax',
  path: '/api/v1/auth',
};

function ponerCookie(res, refreshToken) {
  res.cookie(COOKIE_REFRESH, refreshToken, {
    ...opcionesCookie,
    maxAge: servicio.DIAS_SESION * 24 * 60 * 60 * 1000,
  });
}

const metaPeticion = (req) => ({
  agenteUsuario: req.get('user-agent')?.slice(0, 500) ?? null,
  ip: req.ip ?? null,
});

/** Responde { tokenAcceso, usuario } y deja el refresh token solo en la cookie. */
function responderSesion(res, { refreshToken, ...sesion }) {
  ponerCookie(res, refreshToken);
  res.json(sesion);
}

export async function registrar(req, res) {
  res.status(201).json(await servicio.registrar(req.valido.body));
}

export async function verificarCorreo(req, res) {
  res.json(await servicio.verificarCorreo(req.valido.body.token));
}

export async function reenviarVerificacion(req, res) {
  res.json(await servicio.reenviarVerificacion(req.valido.body.correo));
}

export async function iniciarSesion(req, res) {
  responderSesion(res, await servicio.iniciarSesion(req.valido.body, metaPeticion(req)));
}

export async function refrescar(req, res) {
  try {
    responderSesion(
      res,
      await servicio.refrescar(req.cookies?.[COOKIE_REFRESH], metaPeticion(req)),
    );
  } catch (error) {
    res.clearCookie(COOKIE_REFRESH, opcionesCookie); // cookie inválida: no seguir enviándola
    throw error;
  }
}

export async function restaurar(req, res) {
  res.json(await servicio.restaurar(req.valido.body.tokenSesion));
}

export async function cerrarSesion(req, res) {
  await servicio.cerrarSesion(req.cookies?.[COOKIE_REFRESH]);
  res.clearCookie(COOKIE_REFRESH, opcionesCookie);
  res.status(204).end();
}

export async function olvideClave(req, res) {
  res.json(await servicio.olvideClave(req.valido.body.correo));
}

export async function restablecerClave(req, res) {
  res.json(await servicio.restablecerClave(req.valido.body));
}
