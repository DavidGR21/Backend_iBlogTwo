# iBlog — Backend

API REST + WebSockets de iBlog, una red social tipo blog.

**Stack:** Node 22 · Express 5 · Socket.io · PostgreSQL (Neon) · Neon Storage (S3) · Zod · Argon2 · Brevo (correo)
**Despliegue:** Render (backend) · Vercel (frontend) · Neon (base de datos y archivos)

---

## Arranque rápido

```bash
npm install
cp .env.example .env     # completa los valores
npm run llaves           # pega la salida en tu .env
npm run migrar           # crea las tablas en Neon
npm run dev              # http://localhost:3000/salud
```

| Script                       | Qué hace                                                    |
| ---------------------------- | ----------------------------------------------------------- |
| `npm run dev`                | Servidor con recarga automática al guardar                  |
| `npm start`                  | Servidor de producción (lo usa Render)                      |
| `npm run migrar`             | Aplica las migraciones pendientes de `db/migraciones/`      |
| `npm run llaves`             | Genera JWT_SECRETO, CLAVE_CIFRADO y CLAVE_HMAC              |
| `npm run admin -- <usuario>` | Da el rol de administrador (`--quitar` para quitarlo)       |
| `npm test`                   | Pruebas (`tests/**/*.test.js`) con el runner nativo de Node |
| `npm run lint`               | Revisa errores comunes con ESLint                           |
| `npm run formato`            | Formatea todo el código con Prettier                        |

---

## Estructura

```
iblog-backend/
├─ db/
│  └─ migraciones/            Cambios de la BD, numerados y en orden (001_, 002_…)
├─ scripts/                   Herramientas de terminal (migrar, generar llaves)
├─ tests/                     Pruebas automáticas
├─ src/
│  ├─ server.js               Punto de entrada: levanta HTTP + WebSockets
│  ├─ app.js                  Express: middlewares globales, rutas y errores
│  ├─ rutas.js                Mapa de la API: monta cada módulo bajo /api/v1
│  ├─ config/
│  │  └─ env.js               Lee y valida TODAS las variables de entorno
│  ├─ db/
│  │  ├─ pool.js              Conexión a Neon
│  │  └─ transaccion.js       Helper enTransaccion()
│  ├─ lib/                    Herramientas técnicas sin lógica de negocio
│  │  ├─ almacenamiento.js    Bucket de Neon Storage (URLs prefirmadas)
│  │  ├─ paginacion.js        Cursor opaco y { items, siguienteCursor }
│  │  ├─ cifrado.js           AES-256-GCM y HMAC
│  │  ├─ clave.js             Hash de contraseñas (Argon2id)
│  │  ├─ correo.js            Envío de correos (API de Brevo)
│  │  ├─ logger.js            Logs (pino)
│  │  └─ tokens.js            JWT y tokens aleatorios
│  ├─ errores/
│  │  └─ ErrorApp.js          Errores esperados con su código HTTP
│  ├─ middlewares/            Funciones que corren antes de los controladores
│  │  ├─ autenticar.js        Exige sesión (req.usuario) · autenticarOpcional
│  │  ├─ exigirAdmin.js       Exige rol admin (va después de autenticar)
│  │  ├─ limitarPeticiones.js Anti fuerza bruta
│  │  ├─ manejarErrores.js    Convierte errores en respuestas JSON
│  │  ├─ noEncontrado.js      404 de rutas inexistentes
│  │  └─ validar.js           Valida con Zod (req.valido)
│  ├─ sockets/
│  │  ├─ index.js             Crea Socket.io y registra los módulos
│  │  ├─ autenticarSocket.js  Solo conecta usuarios con token
│  │  ├─ emisor.js            Emitir eventos desde los servicios
│  │  └─ eventos.js           Catálogo de nombres de eventos
│  └─ modulos/                Una carpeta por funcionalidad del negocio
│     ├─ auth/                Registro, verificación de correo, login, sesiones
│     ├─ usuarios/            Cuenta y perfil  ← MÓDULO DE EJEMPLO COMPLETO
│     ├─ archivos/            Subidas al bucket
│     ├─ publicaciones/       Posts y reacciones
│     ├─ comentarios/         Comentarios y respuestas
│     ├─ amistades/           Solicitudes y lista de amigos
│     ├─ mensajes/            Conversaciones y chat
│     └─ admin/               Panel de administración: estadísticas, baneos y moderación
├─ .env.example               Plantilla de variables (sí se sube a Git)
├─ eslint.config.js · .prettierrc · .editorconfig · .nvmrc
└─ package.json
```

### Archivos de cada módulo

Todos los módulos siguen el mismo patrón. Si sabes leer uno, sabes leerlos todos.

| Archivo                   | Responsabilidad                                             | No debe…                       |
| ------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `<modulo>.rutas.js`       | Declara URL + middlewares + controlador                     | contener lógica                |
| `<modulo>.esquemas.js`    | Esquemas Zod de lo que acepta cada endpoint                 | consultar la BD                |
| `<modulo>.controlador.js` | Lee `req.valido`/`req.usuario`, llama al servicio, responde | tener SQL ni reglas de negocio |
| `<modulo>.servicio.js`    | Reglas de negocio, permisos, transacciones, eventos         | usar `req` o `res`             |
| `<modulo>.repositorio.js` | Todo el SQL del módulo                                      | decidir permisos               |
| `<modulo>.mapeador.js`    | Fila de BD → objeto de la API (camelCase, sin secretos)     | consultar nada                 |
| `<modulo>.sockets.js`     | Eventos de Socket.io del módulo (si los tiene)              | tener SQL                      |

### Flujo de una petición

```
HTTP → rutas → validar → [autenticar] → controlador → servicio → repositorio → Postgres
                                                        │
                                                        ├→ mapeador → respuesta JSON
                                                        └→ sockets/emisor → clientes en vivo
cualquier error lanzado ──────────────────────────────────→ manejarErrores → JSON de error
```

---

## Reglas del proyecto

1. **Dependencias en una sola dirección:** `rutas → controlador → servicio → repositorio`.
   Un repositorio nunca importa un servicio; un servicio nunca importa un controlador.
2. **Entre módulos solo se usan servicios.** Si `mensajes` necesita saber si dos usuarios son amigos,
   llama a `amistades.servicio.js`; nunca a `amistades.repositorio.js`.
3. **`process.env` solo se lee en `config/env.js`.** El resto importa `env`.
4. **El SQL vive solo en repositorios**, siempre parametrizado (`$1`, `$2`…).
5. **Nunca devolver filas crudas al cliente:** siempre pasar por el mapeador.
6. **Errores esperados con `ErrorApp`** (`throw ErrorApp.noEncontrado(...)`). Sin `try/catch` en
   controladores: Express 5 envía los errores async a `manejarErrores`.
7. **Nombres de eventos solo desde `sockets/eventos.js`.**
8. **Las migraciones aplicadas no se editan:** se crea una nueva con el siguiente número.

### Convenciones de nombres

- Archivos: `modulo.capa.js` (ej. `publicaciones.servicio.js`). Clases en PascalCase (`ErrorApp.js`).
- Código en español, `camelCase`. Base de datos en `snake_case`. JSON de la API en `camelCase`.
- Funciones con verbo: `crearPublicacion`, `buscarPorId`, `listarFeed`.
- Repositorios: `buscar…`, `listar…`, `crear…`, `actualizar…`, `eliminar…`/`marcarEliminado…`.

### Formato de respuestas

```jsonc
// Éxito: el recurso directamente, o una lista paginada
{ "items": [ … ], "siguienteCursor": "2026-10-20T08:00:00Z" }

// Error (siempre igual)
{ "error": { "codigo": "NO_ENCONTRADO", "mensaje": "Publicación no encontrada", "detalles": [ … ] } }
```

---

## Cómo agregar un módulo nuevo

1. Copia la carpeta `src/modulos/usuarios/` y renombra los archivos.
2. Escribe los esquemas, luego el repositorio, el servicio, el controlador y las rutas.
3. Regístralo en `src/rutas.js` (y en `sockets/index.js` si tiene eventos).
4. Si necesita tablas nuevas: crea `db/migraciones/00X_descripcion.sql` y ejecuta `npm run migrar`.
5. Documenta sus endpoints en el comentario de `<modulo>.rutas.js` con `[ ]` / `[x]`.

---

## Seguridad

- **Contraseñas:** Argon2id (`lib/clave.js`). Nunca se cifran ni se guardan en claro.
- **Datos personales** (correo, teléfono, mensajes): AES-256-GCM en el backend (`lib/cifrado.js`).
- **Búsqueda del correo:** `usuarios.correo_hash` = HMAC-SHA256 del correo normalizado.
- **Tokens de un solo uso y refresh tokens:** en la BD solo se guarda su SHA-256.
- **Llaves:** solo en variables de entorno. ⚠️ Si pierdes `CLAVE_CIFRADO` o `CLAVE_HMAC` de producción,
  los datos cifrados no se pueden recuperar. Guárdalas en un gestor de contraseñas.

---

## Administración

- El rol vive en `usuarios.rol` (`usuario` | `admin`). La migración `003` se lo da a la cuenta
  `Admin`; para otras cuentas: `npm run admin -- <nombre_usuario>` (con la `DATABASE_URL` que
  corresponda). Desde la web nadie puede cambiar roles.
- Suspender una cuenta revoca sus sesiones, corta su token de acceso vigente (`lib/suspendidos.js`)
  y sus sockets. Las vistas solo muestran cuentas activas, así que su contenido deja de verse.
- Toda acción de un administrador queda en la tabla `acciones_admin`.
- Imágenes del bucket: al eliminar una publicación se borran sus imágenes; al editarla, las
  quitadas; al cambiar la foto de perfil, la anterior. Además, cada hora `limpiarHuerfanos`
  borra las subidas sin confirmar y las imágenes que nada usa (más de 24 h).

---

## Despliegue en Render

1. Nuevo **Web Service** desde el repositorio de GitHub.
2. Build command: `npm install` · Start command: `npm start`.
3. En **Environment** carga las mismas variables del `.env`, con `NODE_ENV=production`
   y `FRONTEND_URL` apuntando a tu dominio de Vercel.
4. Health check path: `/salud`.
5. Las migraciones se ejecutan desde tu máquina con la `DATABASE_URL` de producción:
   `npm run migrar`.
6. El bucket de Neon Storage debe permitir CORS para `PUT` y `GET` desde el dominio del
   frontend (el navegador sube y descarga las imágenes directamente con URLs prefirmadas).

> El plan gratuito de Render bloquea SMTP: por eso el correo usa la API HTTP de Brevo.
