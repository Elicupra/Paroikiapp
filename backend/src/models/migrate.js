const pool = require('./db');

const schema = `
-- Tipos enumerados
CREATE TYPE tipo_evento AS ENUM ('campamento', 'peregrinacion', 'viaje', 'otro');
CREATE TYPE rol_usuario AS ENUM ('monitor', 'organizador');
CREATE TYPE tipo_documento AS ENUM ('autorizacion_paterna', 'tarjeta_sanitaria', 'otro');

-- Tabla de eventos
CREATE TABLE IF NOT EXISTS eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo tipo_evento NOT NULL DEFAULT 'campamento',
  descripcion TEXT,
  precio_base NUMERIC(8,2),
  fecha_inicio DATE,
  fecha_fin DATE,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'monitor',
  nombre_mostrado TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  ultimo_login TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla de refresh tokens (para invalidar sesiones)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  expira_en TIMESTAMPTZ NOT NULL,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla de monitores
CREATE TABLE IF NOT EXISTS monitores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  evento_id UUID REFERENCES eventos(id) ON DELETE CASCADE,
  enlace_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  activo BOOLEAN DEFAULT true,
  UNIQUE(usuario_id, evento_id),
  creado_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla de jóvenes
CREATE TABLE IF NOT EXISTS jovenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  monitor_id UUID REFERENCES monitores(id) ON DELETE RESTRICT,
  evento_id UUID REFERENCES eventos(id) ON DELETE RESTRICT,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla de documentos
CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id UUID REFERENCES jovenes(id) ON DELETE CASCADE,
  tipo tipo_documento NOT NULL,
  ruta_interna TEXT NOT NULL,
  nombre_original TEXT,
  mime_type TEXT NOT NULL,
  tamaño_bytes INTEGER,
  subido_en TIMESTAMPTZ DEFAULT now()
);

-- Tabla de pagos
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  joven_id UUID REFERENCES jovenes(id) ON DELETE CASCADE,
  plazo_numero INTEGER NOT NULL,
  cantidad NUMERIC(8,2) NOT NULL,
  pagado BOOLEAN DEFAULT false,
  es_especial BOOLEAN DEFAULT false,
  nota_especial TEXT,
  descuento NUMERIC(8,2) DEFAULT 0,
  fecha_pago TIMESTAMPTZ,
  registrado_por UUID REFERENCES usuarios(id),
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_monitores_usuario ON monitores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_monitores_evento ON monitores(evento_id);
CREATE INDEX IF NOT EXISTS idx_jovenes_monitor ON jovenes(monitor_id);
CREATE INDEX IF NOT EXISTS idx_jovenes_evento ON jovenes(evento_id);
CREATE INDEX IF NOT EXISTS idx_documentos_joven ON documentos(joven_id);
CREATE INDEX IF NOT EXISTS idx_pagos_joven ON pagos(joven_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_usuario ON refresh_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
`;

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Starting migrations...');
    await client.query(schema);
    console.log('✓ Database schema created successfully');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
  }
}

runMigrations().then(() => {
  console.log('Migration complete');
  process.exit(0);
}).catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
