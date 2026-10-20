import { enviarCorreo } from '../src/lib/correo.js';

const para = process.argv[2];
if (!para) throw new Error('Uso: node --env-file=.env scripts/probar-correo.js tu@correo.com');

await enviarCorreo({ para, asunto: 'Prueba iBlog', html: '<h1>¡Funciona! 🎉</h1>' });
console.log('✔ Enviado a', para);
