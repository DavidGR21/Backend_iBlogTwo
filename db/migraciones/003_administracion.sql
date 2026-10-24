-- =====================================================================
--  003 — Administración y moderación
--
--   * usuarios.rol: 'usuario' | 'admin'. Solo un admin entra al panel /admin.
--   * Suspender (banear) una cuenta = estado 'suspendido' + motivo + quién y cuándo.
--     Las vistas existentes ya ocultan el contenido de cuentas no activas.
--   * acciones_admin: registro de auditoría de todo lo que hace un administrador.
--   * El primer administrador es la cuenta con nombre de usuario "Admin". Para dar
--     el rol a otra cuenta más adelante: npm run admin -- <nombre_usuario>
-- =====================================================================

CREATE TYPE rol_usuario AS ENUM ('usuario', 'admin');

ALTER TABLE usuarios
  ADD COLUMN rol               rol_usuario  NOT NULL DEFAULT 'usuario',
  ADD COLUMN suspendido_en     timestamptz,
  ADD COLUMN suspendido_por    uuid         REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN motivo_suspension varchar(300);

CREATE INDEX ix_usuarios_creado ON usuarios (creado_en DESC, id DESC);

-- Quién borró una publicación o comentario cuando no fue su autor (moderación).
ALTER TABLE publicaciones ADD COLUMN eliminado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE comentarios   ADD COLUMN eliminado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE TABLE acciones_admin (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       uuid         REFERENCES usuarios(id) ON DELETE SET NULL,
  accion         varchar(40)  NOT NULL,   -- 'suspender_usuario', 'eliminar_publicacion'…
  objetivo_tipo  varchar(20)  NOT NULL,   -- 'usuario' | 'publicacion' | 'comentario' | 'sistema'
  objetivo_id    text,
  detalle        varchar(500),
  creado_en      timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX ix_acciones_admin_fecha ON acciones_admin (creado_en DESC, id DESC);

UPDATE usuarios SET rol = 'admin' WHERE nombre_usuario = 'Admin';
