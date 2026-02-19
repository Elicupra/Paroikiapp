-- Agregar campos adicionales a la tabla eventos
-- Ejecutar: psql -U postgres -d paroikiapp -f migrations/002_add_evento_fields.sql

BEGIN;

-- Agregar campos nuevos
ALTER TABLE eventos
ADD COLUMN IF NOT EXISTS descripcion TEXT,
ADD COLUMN IF NOT EXISTS localizacion TEXT,
ADD COLUMN IF NOT EXISTS fotos TEXT[], -- Array de URLs o paths de fotos
ADD COLUMN IF NOT EXISTS otra_informacion TEXT;

COMMIT;

-- Verificar cambios
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'eventos';
