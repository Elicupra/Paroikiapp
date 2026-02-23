const pool = require('./db');

async function ensureAdvancedSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tipos_evento (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre TEXT NOT NULL UNIQUE,
      activo BOOLEAN DEFAULT true
    );
  `);

  await pool.query(`
    ALTER TABLE eventos
    ADD COLUMN IF NOT EXISTS tipo_evento_id UUID REFERENCES tipos_evento(id);
  `);

  await pool.query(`
    INSERT INTO tipos_evento (nombre)
    VALUES ('Campamento'), ('Peregrinación'), ('Viaje')
    ON CONFLICT (nombre) DO NOTHING;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS evento_config (
      evento_id UUID PRIMARY KEY REFERENCES eventos(id) ON DELETE CASCADE,
      descuento_global NUMERIC(8,2) DEFAULT 0,
      actualizado_en TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS joven_accesos (
      token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      joven_id UUID UNIQUE REFERENCES jovenes(id) ON DELETE CASCADE,
      creado_en TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS asignacion_eventos (
      monitor_id UUID REFERENCES monitores(id) ON DELETE CASCADE,
      evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
      enlace_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
      max_jovenes INTEGER DEFAULT NULL,
      activo BOOLEAN DEFAULT true,
      PRIMARY KEY (monitor_id, evento_id)
    );
  `);

  await pool.query(`
    INSERT INTO asignacion_eventos (monitor_id, evento_id, enlace_token, activo)
    SELECT m.id, m.evento_id, m.enlace_token, m.activo
    FROM monitores m
    ON CONFLICT (monitor_id, evento_id) DO UPDATE
    SET enlace_token = EXCLUDED.enlace_token,
        activo = EXCLUDED.activo;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documento_validaciones (
      documento_id UUID PRIMARY KEY REFERENCES documentos(id) ON DELETE CASCADE,
      validado BOOLEAN DEFAULT false,
      validado_por UUID REFERENCES usuarios(id),
      validado_en TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      tipo TEXT DEFAULT 'texto'
    );
  `);

  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS notificacion_email TEXT;
  `);

  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS notificacion_webhook TEXT;
  `);

  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS notificacion_email_habilitada BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    UPDATE usuarios
    SET notificacion_email = email
    WHERE (notificacion_email IS NULL OR notificacion_email = '')
      AND email IS NOT NULL;
  `);

  await pool.query(`
    INSERT INTO configuracion (clave, valor, tipo)
    VALUES
      ('app_nombre', 'Paroikiapp', 'texto'),
      ('parroquia_nombre', 'Parroquia San Miguel', 'texto'),
      ('parroquia_texto', 'Bienvenidos a nuestra parroquia. Aquí encontrarás información sobre nuestros eventos y actividades para jóvenes de nuestra comunidad.', 'texto'),
      ('parroquia_logo', '', 'imagen'),
      ('color_primario', '#2563eb', 'color'),
      ('color_secundario', '#1e40af', 'color'),
      ('color_acento', '#f59e0b', 'color'),
      ('contacto_email', '', 'texto'),
      ('contacto_telefono', '', 'texto'),
      ('contacto_direccion', '', 'texto')
    ON CONFLICT (clave) DO NOTHING;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monitor_ficheros (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      monitor_id UUID REFERENCES monitores(id) ON DELETE CASCADE,
      ruta_interna TEXT NOT NULL,
      nombre_original TEXT,
      mime_type TEXT NOT NULL,
      subido_en TIMESTAMPTZ DEFAULT now()
    );
  `);
}

module.exports = { ensureAdvancedSchema };
