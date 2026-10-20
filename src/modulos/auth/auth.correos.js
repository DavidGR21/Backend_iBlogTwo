/**
 * Plantillas HTML de los correos de auth (verificación, recuperar clave).
 * Mantenerlas aquí evita mezclar HTML con la lógica del servicio.
 */

const escapar = (texto) =>
  String(texto).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function plantilla({ titulo, saludo, texto, boton, enlace, pie }) {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px">
          <tr><td>
            <h1 style="margin:0 0 16px;font-size:22px;color:#2563eb">iBlog</h1>
            <h2 style="margin:0 0 12px;font-size:18px">${titulo}</h2>
            <p style="margin:0 0 12px;line-height:1.5">${saludo}</p>
            <p style="margin:0 0 24px;line-height:1.5">${texto}</p>
            <p style="margin:0 0 24px;text-align:center">
              <a href="${enlace}" style="display:inline-block;background:#2563eb;color:#ffffff;
                 text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold">${boton}</a>
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#52606d;line-height:1.5">
              Si el botón no funciona, copia este enlace en tu navegador:<br>
              <a href="${enlace}" style="color:#2563eb;word-break:break-all">${enlace}</a>
            </p>
            <p style="margin:16px 0 0;font-size:13px;color:#7b8794;line-height:1.5">${pie}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function correoVerificacion({ nombre, enlace }) {
  return {
    asunto: 'Confirma tu correo en iBlog',
    html: plantilla({
      titulo: 'Confirma tu correo',
      saludo: `¡Hola, ${escapar(nombre)}! 👋`,
      texto: 'Gracias por unirte a iBlog. Para activar tu cuenta, confirma tu correo:',
      boton: 'Confirmar correo',
      enlace,
      pie: 'El enlace vence en 24 horas. Si no creaste esta cuenta, ignora este correo.',
    }),
  };
}

export function correoRecuperarClave({ nombre, enlace }) {
  return {
    asunto: 'Restablece tu contraseña de iBlog',
    html: plantilla({
      titulo: 'Restablecer contraseña',
      saludo: `Hola, ${escapar(nombre)}.`,
      texto: 'Recibimos una solicitud para cambiar tu contraseña. Elige una nueva aquí:',
      boton: 'Elegir nueva contraseña',
      enlace,
      pie: 'El enlace vence en 1 hora. Si no lo pediste tú, ignora este correo: tu contraseña no cambiará.',
    }),
  };
}
