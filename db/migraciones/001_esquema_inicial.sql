-- =====================================================================
--  Red social (proyecto de portafolio) — Esquema base
--  Motor: PostgreSQL 16+ (Neon)
--
--  Convenciones:
--   * IDs uuid (gen_random_uuid) salvo mensajes (bigint, para paginar por cursor).
--   * Borrado lógico con "eliminado_en" en contenido de usuarios.
--   * Columnas *_cifrado (bytea): AES-256-GCM hecho en el backend (Node),
--     guardando iv(12) || tag(16) || texto_cifrado. La llave vive en una
--     variable de entorno de Render, NUNCA en la base.
--   * Columnas *_hash (bytea): HMAC-SHA256 con otra llave de entorno. Sirven
--     de "índice ciego" para buscar/validar unicidad sin descifrar.
--   * clave_hash: Argon2id (o bcrypt). Las contraseñas NO se cifran.
-- =====================================================================


CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------
--  Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE estado_cuenta           AS ENUM ('activo', 'suspendido', 'eliminado');
CREATE TYPE proposito_token         AS ENUM ('verificacion_correo', 'restablecer_clave', 'cambio_correo');
CREATE TYPE estado_archivo          AS ENUM ('pendiente', 'subido');
CREATE TYPE visibilidad_publicacion AS ENUM ('publico', 'amigos', 'privado');
CREATE TYPE tipo_reaccion           AS ENUM ('me_gusta', 'me_encanta', 'me_divierte', 'me_asombra',
                                             'me_entristece', 'me_enoja', 'me_disgusta');
CREATE TYPE estado_amistad          AS ENUM ('pendiente', 'aceptada');

-- ---------------------------------------------------------------------
--  Función genérica para mantener "actualizado_en"
-- ---------------------------------------------------------------------
CREATE FUNCTION fn_actualizar_timestamp() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

-- =====================================================================
--  1. USUARIOS Y AUTENTICACIÓN
-- =====================================================================
CREATE TABLE usuarios (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_usuario        citext        NOT NULL UNIQUE
                                      CHECK (nombre_usuario ~ '^[A-Za-z0-9_.]{3,30}$'),
  correo_cifrado        bytea         NOT NULL,          -- AES-256-GCM
  correo_hash           bytea         NOT NULL UNIQUE,   -- HMAC(lower(correo)) para login/unicidad
  clave_hash            text          NOT NULL,          -- Argon2id
  correo_verificado_en  timestamptz,                     -- NULL = aún no verificó su correo
  estado                estado_cuenta NOT NULL DEFAULT 'activo',
  ultimo_acceso_en      timestamptz,
  creado_en             timestamptz   NOT NULL DEFAULT now(),
  actualizado_en        timestamptz   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_usuarios_actualizado
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- Tokens de un solo uso: verificación de correo, recuperación de clave, cambio de correo.
-- Se guarda solo el HASH del token; el token en claro viaja únicamente en el enlace del correo.
CREATE TABLE tokens_usuario (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid            NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  proposito           proposito_token NOT NULL,
  token_hash          bytea           NOT NULL UNIQUE,   -- SHA-256 del token
  dato_extra_cifrado  bytea,                             -- p. ej. el nuevo correo en 'cambio_correo'
  expira_en           timestamptz     NOT NULL,
  usado_en            timestamptz,
  creado_en           timestamptz     NOT NULL DEFAULT now(),
  CHECK (expira_en > creado_en),
  CHECK (proposito <> 'cambio_correo' OR dato_extra_cifrado IS NOT NULL)
);
CREATE INDEX ix_tokens_usuario_proposito ON tokens_usuario (usuario_id, proposito);

-- Sesiones / refresh tokens (también sirven para autenticar el handshake de Socket.io).
CREATE TABLE sesiones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  refresh_token_hash  bytea       NOT NULL UNIQUE,
  agente_usuario      text,
  ip                  inet,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  expira_en           timestamptz NOT NULL,
  revocado_en         timestamptz,
  CHECK (expira_en > creado_en)
);
CREATE INDEX ix_sesiones_usuario ON sesiones (usuario_id) WHERE revocado_en IS NULL;

-- =====================================================================
--  2. ARCHIVOS (objetos en el bucket de Neon Storage)
--  Tabla única para fotos de perfil, imágenes de posts y adjuntos de mensajes.
--  Flujo: backend crea la fila 'pendiente' + URL prefirmada -> el cliente sube
--  directo al bucket -> backend confirma y pasa a 'subido'.
-- =====================================================================
CREATE TABLE archivos (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario_id   uuid           NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  bucket           text           NOT NULL,
  clave_objeto     text           NOT NULL,                -- key dentro del bucket, ej. 'posts/<uuid>.webp'
  tipo_mime        text           NOT NULL
                                  CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  tamano_bytes     bigint         NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 10485760), -- 10 MB
  ancho            integer        CHECK (ancho > 0),
  alto             integer        CHECK (alto  > 0),
  checksum_sha256  bytea,
  estado           estado_archivo NOT NULL DEFAULT 'pendiente',
  creado_en        timestamptz    NOT NULL DEFAULT now(),
  eliminado_en     timestamptz,
  UNIQUE (bucket, clave_objeto)
);
CREATE INDEX ix_archivos_propietario ON archivos (propietario_id);
CREATE INDEX ix_archivos_pendientes  ON archivos (creado_en) WHERE estado = 'pendiente';  -- limpieza de huérfanos

-- =====================================================================
--  3. PERFILES
-- =====================================================================
CREATE TABLE paises (
  codigo              char(2)     PRIMARY KEY CHECK (codigo ~ '^[A-Z]{2}$'),  -- ISO 3166-1 alfa-2
  nombre              varchar(80) NOT NULL UNIQUE,
  prefijo_telefonico  varchar(6)  CHECK (prefijo_telefonico ~ '^\+[0-9]{1,4}$')
);

-- 1:1 con usuarios. El correo NO se duplica aquí: vive en usuarios.
CREATE TABLE perfiles (
  usuario_id        uuid         PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  nombres           varchar(60)  NOT NULL CHECK (char_length(btrim(nombres)) > 0),
  apellidos         varchar(60),
  biografia         varchar(300),
  pais_codigo       char(2)      REFERENCES paises(codigo),
  telefono_cifrado  bytea,                                   -- AES-256-GCM, formato E.164 antes de cifrar
  fecha_nacimiento  date         CHECK (fecha_nacimiento BETWEEN DATE '1900-01-01' AND CURRENT_DATE),
  foto_perfil_id    uuid         REFERENCES archivos(id) ON DELETE SET NULL,
  foto_portada_id   uuid         REFERENCES archivos(id) ON DELETE SET NULL,
  creado_en         timestamptz  NOT NULL DEFAULT now(),
  actualizado_en    timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_perfiles_pais ON perfiles (pais_codigo);

CREATE TRIGGER trg_perfiles_actualizado
  BEFORE UPDATE ON perfiles
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- =====================================================================
--  4. PUBLICACIONES
-- =====================================================================
CREATE TABLE publicaciones (
  id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id        uuid                    NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  contenido       text                    NOT NULL
                                          CHECK (char_length(btrim(contenido)) BETWEEN 1 AND 5000),
  visibilidad     visibilidad_publicacion NOT NULL DEFAULT 'publico',
  creado_en       timestamptz             NOT NULL DEFAULT now(),
  actualizado_en  timestamptz             NOT NULL DEFAULT now(),   -- > creado_en => "editado"
  eliminado_en    timestamptz
);
CREATE INDEX ix_publicaciones_autor ON publicaciones (autor_id, creado_en DESC)
  WHERE eliminado_en IS NULL;
CREATE INDEX ix_publicaciones_feed  ON publicaciones (creado_en DESC)
  WHERE eliminado_en IS NULL AND visibilidad = 'publico';

CREATE TRIGGER trg_publicaciones_actualizado
  BEFORE UPDATE ON publicaciones
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- Relación post <-> archivo del bucket (0..10 imágenes por post, ordenadas).
CREATE TABLE publicacion_archivos (
  publicacion_id  uuid     NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  archivo_id      uuid     NOT NULL REFERENCES archivos(id)      ON DELETE CASCADE,
  orden           smallint NOT NULL DEFAULT 0 CHECK (orden BETWEEN 0 AND 9),
  PRIMARY KEY (publicacion_id, archivo_id),
  UNIQUE (archivo_id),                -- un archivo pertenece a un solo post
  UNIQUE (publicacion_id, orden)
);

-- Una reacción por usuario y post; cambiar de reacción = UPDATE (o INSERT ... ON CONFLICT).
CREATE TABLE reacciones_publicacion (
  publicacion_id  uuid          NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  usuario_id      uuid          NOT NULL REFERENCES usuarios(id)      ON DELETE CASCADE,
  tipo            tipo_reaccion NOT NULL,
  creado_en       timestamptz   NOT NULL DEFAULT now(),
  actualizado_en  timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (publicacion_id, usuario_id)
);
CREATE INDEX ix_reacciones_usuario ON reacciones_publicacion (usuario_id);

CREATE TRIGGER trg_reacciones_actualizado
  BEFORE UPDATE ON reacciones_publicacion
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- =====================================================================
--  5. COMENTARIOS Y RESPUESTAS
--  comentario_padre_id NULL = comentario raíz; con valor = respuesta.
--  La FK compuesta garantiza que una respuesta pertenezca al MISMO post que su padre.
-- =====================================================================
CREATE TABLE comentarios (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacion_id       uuid        NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  autor_id             uuid        NOT NULL REFERENCES usuarios(id)      ON DELETE CASCADE,
  comentario_padre_id  uuid,
  contenido            text        NOT NULL CHECK (char_length(btrim(contenido)) BETWEEN 1 AND 2000),
  creado_en            timestamptz NOT NULL DEFAULT now(),
  actualizado_en       timestamptz NOT NULL DEFAULT now(),
  eliminado_en         timestamptz,                       -- se muestra "comentario eliminado" si tiene respuestas
  UNIQUE (id, publicacion_id),
  CHECK (comentario_padre_id IS NULL OR comentario_padre_id <> id),
  FOREIGN KEY (comentario_padre_id, publicacion_id)
    REFERENCES comentarios (id, publicacion_id) ON DELETE CASCADE
);
CREATE INDEX ix_comentarios_raiz      ON comentarios (publicacion_id, creado_en)
  WHERE comentario_padre_id IS NULL;
CREATE INDEX ix_comentarios_respuestas ON comentarios (comentario_padre_id, creado_en)
  WHERE comentario_padre_id IS NOT NULL;
CREATE INDEX ix_comentarios_autor     ON comentarios (autor_id);

CREATE TRIGGER trg_comentarios_actualizado
  BEFORE UPDATE ON comentarios
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- =====================================================================
--  6. AMISTADES
--  Una sola fila por par de usuarios (en cualquier dirección).
--  Rechazar solicitud o eliminar amigo = DELETE de la fila.
-- =====================================================================
CREATE TABLE amistades (
  id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id   uuid           NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  destinatario_id  uuid           NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  estado           estado_amistad NOT NULL DEFAULT 'pendiente',
  creado_en        timestamptz    NOT NULL DEFAULT now(),
  aceptada_en      timestamptz,
  CHECK (solicitante_id <> destinatario_id),
  CHECK ((estado = 'aceptada') = (aceptada_en IS NOT NULL))
);
CREATE UNIQUE INDEX ux_amistades_par ON amistades
  (LEAST(solicitante_id, destinatario_id), GREATEST(solicitante_id, destinatario_id));
CREATE INDEX ix_amistades_solicitante  ON amistades (solicitante_id, estado);
CREATE INDEX ix_amistades_destinatario ON amistades (destinatario_id, estado);

-- Vista simétrica: "amigos de X" = SELECT amigo_id FROM v_amigos WHERE usuario_id = X
CREATE VIEW v_amigos AS
  SELECT solicitante_id AS usuario_id, destinatario_id AS amigo_id, aceptada_en
    FROM amistades WHERE estado = 'aceptada'
  UNION ALL
  SELECT destinatario_id, solicitante_id, aceptada_en
    FROM amistades WHERE estado = 'aceptada';

-- =====================================================================
--  7. MENSAJERÍA
--  Modelo conversación + participantes: hoy chats 1 a 1, mañana grupos sin migrar.
-- =====================================================================
CREATE TABLE conversaciones (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_directa      text        UNIQUE,   -- '<uuid_menor>:<uuid_mayor>' en chats 1 a 1; NULL en grupos
  creado_en          timestamptz NOT NULL DEFAULT now(),
  ultimo_mensaje_en  timestamptz           -- para ordenar la bandeja de entrada
);

CREATE TABLE conversacion_participantes (
  conversacion_id          uuid        NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
  usuario_id               uuid        NOT NULL REFERENCES usuarios(id)       ON DELETE CASCADE,
  unido_en                 timestamptz NOT NULL DEFAULT now(),
  ultimo_leido_mensaje_id  bigint,     -- FK agregada abajo; sirve para contar no leídos
  silenciada               boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (conversacion_id, usuario_id)
);
CREATE INDEX ix_participantes_usuario ON conversacion_participantes (usuario_id);

CREATE TABLE mensajes (
  id                 bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversacion_id    uuid        NOT NULL,
  remitente_id       uuid        NOT NULL,
  contenido_cifrado  bytea,                                   -- AES-256-GCM
  archivo_id         uuid        REFERENCES archivos(id),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  editado_en         timestamptz,
  eliminado_en       timestamptz,
  CHECK (contenido_cifrado IS NOT NULL OR archivo_id IS NOT NULL),
  -- El remitente debe ser participante de la conversación:
  FOREIGN KEY (conversacion_id, remitente_id)
    REFERENCES conversacion_participantes (conversacion_id, usuario_id) ON DELETE CASCADE
);
CREATE INDEX ix_mensajes_conversacion ON mensajes (conversacion_id, id DESC);

ALTER TABLE conversacion_participantes
  ADD CONSTRAINT fk_participantes_ultimo_leido
  FOREIGN KEY (ultimo_leido_mensaje_id) REFERENCES mensajes(id) ON DELETE SET NULL;

-- Mantiene conversaciones.ultimo_mensaje_en al día.
CREATE FUNCTION fn_tocar_conversacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversaciones SET ultimo_mensaje_en = NEW.creado_en WHERE id = NEW.conversacion_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mensajes_tocar_conversacion
  AFTER INSERT ON mensajes
  FOR EACH ROW EXECUTE FUNCTION fn_tocar_conversacion();

-- =====================================================================
--  8. VISTAS DE APOYO
-- =====================================================================
CREATE VIEW v_conteo_reacciones AS
  SELECT publicacion_id, tipo, count(*)::int AS total
    FROM reacciones_publicacion
   GROUP BY publicacion_id, tipo;

-- =====================================================================
--  9. DATOS SEMILLA
-- =====================================================================
INSERT INTO paises (codigo, nombre, prefijo_telefonico) VALUES
  ('EC', 'Ecuador',        '+593'),
  ('CO', 'Colombia',       '+57'),
  ('PE', 'Perú',           '+51'),
  ('MX', 'México',         '+52'),
  ('AR', 'Argentina',      '+54'),
  ('CL', 'Chile',          '+56'),
  ('ES', 'España',         '+34'),
  ('US', 'Estados Unidos', '+1');

