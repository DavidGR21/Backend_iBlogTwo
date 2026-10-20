-- =====================================================================
--  002 — Vistas de apoyo para la API
-- =====================================================================

-- "UsuarioResumen" de la API (autor, amigo, participante…).
-- Solo cuentas activas y verificadas: el contenido de cuentas suspendidas
-- desaparece de los listados al hacer JOIN con esta vista.
-- Los repositorios la usan con to_jsonb(ur) para traer al usuario en una sola columna.
CREATE VIEW v_usuarios_resumen AS
  SELECT u.id,
         u.nombre_usuario,
         p.nombres,
         p.apellidos,
         a.clave_objeto AS foto_perfil_clave
    FROM usuarios u
    JOIN perfiles p      ON p.usuario_id = u.id
    LEFT JOIN archivos a ON a.id = p.foto_perfil_id
                        AND a.estado = 'subido'
                        AND a.eliminado_en IS NULL
   WHERE u.estado = 'activo'
     AND u.correo_verificado_en IS NOT NULL;

-- Feed y perfil se ordenan por (creado_en, id): índice compuesto para el cursor.
CREATE INDEX ix_publicaciones_cursor ON publicaciones (creado_en DESC, id DESC)
  WHERE eliminado_en IS NULL;
