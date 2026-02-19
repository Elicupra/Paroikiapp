const pool = require('./db');

async function ensureAdvancedSchema() {
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
    CREATE TABLE IF NOT EXISTS documento_validaciones (
      documento_id UUID PRIMARY KEY REFERENCES documentos(id) ON DELETE CASCADE,
      validado BOOLEAN DEFAULT false,
      validado_por UUID REFERENCES usuarios(id),
      validado_en TIMESTAMPTZ
    );
  `);
}

module.exports = { ensureAdvancedSchema };
