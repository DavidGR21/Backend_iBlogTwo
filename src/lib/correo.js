/**
 * Envío de correos por la API HTTP de Brevo.
 *
 * Render gratuito bloquea los puertos SMTP, por eso no se usa nodemailer/SMTP.
 * Sin BREVO_API_KEY (desarrollo) el correo se muestra en la consola.
 */
import { env } from '../config/env.js';
import { logger } from './logger.js';

const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';

export async function enviarCorreo({ para, asunto, html }) {
  if (!env.BREVO_API_KEY || !env.CORREO_REMITENTE_EMAIL) {
    logger.warn({ para, asunto }, 'Correo NO enviado (Brevo sin configurar). Contenido:');
    logger.info(html);
    return;
  }

  const respuesta = await fetch(URL_BREVO, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: env.CORREO_REMITENTE_NOMBRE, email: env.CORREO_REMITENTE_EMAIL },
      to: [{ email: para }],
      subject: asunto,
      htmlContent: html,
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Brevo respondió ${respuesta.status}: ${detalle}`);
  }
}
