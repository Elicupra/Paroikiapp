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
}

module.exports = { ensureAdvancedSchema };
