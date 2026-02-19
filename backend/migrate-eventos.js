// Script para ejecutar la migración de agregar campos a eventos
const pool = require('./src/models/db');

async function migrate() {
  try {
    console.log('Iniciando migración: Agregar campos a eventos...');
    
    await pool.query(`
      ALTER TABLE eventos
      ADD COLUMN IF NOT EXISTS descripcion TEXT,
      ADD COLUMN IF NOT EXISTS localizacion TEXT,
      ADD COLUMN IF NOT EXISTS fotos TEXT[], -- Array de URLs o paths de fotos
      ADD COLUMN IF NOT EXISTS otra_informacion TEXT;
    `);
    
    console.log('✓ Campos agregados exitosamente');
    
    // Verificar cambios
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'eventos'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nEstructura actual de la tabla eventos:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    await pool.end();
    console.log('\n✓ Migración completada');
  } catch (error) {
    console.error('Error en migración:', error);
    await pool.end();
    process.exit(1);
  }
}

migrate();
