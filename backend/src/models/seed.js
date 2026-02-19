const pool = require('./db');
const { hashPassword, generateUUID } = require('../utils/crypto');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Starting seed...');

    // 1. Crear eventos
    const eventoResult = await client.query(`
      INSERT INTO eventos (nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin)
      VALUES 
        ('Campamento Verano 2026', 'campamento', 'Campamento de verano 2026', 150.00, '2026-07-01', '2026-07-15'),
        ('Peregrinación Primavera', 'peregrinacion', 'Peregrinación primavera', 100.00, '2026-05-01', '2026-05-05')
      RETURNING id
    `);

    const evento1Id = eventoResult.rows[0].id;
    const evento2Id = eventoResult.rows[1].id;
    console.log('✓ Eventos creados');

    // 2. Crear usuarios (monitores y organizadores)
    const passwordHash = await hashPassword('password123');

    const usuarioResult = await client.query(`
      INSERT INTO usuarios (email, password_hash, nombre_mostrado, rol)
      VALUES 
        ('monitor1@example.com', $1, 'Carlos López', 'monitor'),
        ('monitor2@example.com', $1, 'Ana García', 'monitor'),
        ('admin@example.com', $1, 'Administrador Sistema', 'organizador')
      RETURNING id, rol
    `, [passwordHash]);

    const monitor1Id = usuarioResult.rows[0].id;
    const monitor2Id = usuarioResult.rows[1].id;
    const adminId = usuarioResult.rows[2].id;
    console.log('✓ Usuarios creados');

    // 3. Crear monitores (enlace entre usuario y evento)
    const monitorResult = await client.query(`
      INSERT INTO monitores (usuario_id, evento_id, enlace_token)
      VALUES 
        ($1, $2, $3),
        ($4, $5, $6)
      RETURNING id, enlace_token
    `, [monitor1Id, evento1Id, generateUUID(), monitor2Id, evento2Id, generateUUID()]);

    const monitor1 = monitorResult.rows[0];
    const monitor2 = monitorResult.rows[1];
    console.log('✓ Monitores creados');
    console.log(`  Token monitor1: ${monitor1.enlace_token}`);
    console.log(`  Token monitor2: ${monitor2.enlace_token}`);

    // 4. Crear jóvenes de prueba
    const jovenResult = await client.query(`
      INSERT INTO jovenes (nombre, apellidos, monitor_id, evento_id)
      VALUES 
        ('Juan', 'Pérez García', $1, $2),
        ('María', 'Rodríguez López', $1, $2),
        ('Pedro', 'Martínez Ruiz', $3, $4)
      RETURNING id
    `, [monitor1.id, evento1Id, monitor2.id, evento2Id]);

    const joven1Id = jovenResult.rows[0].id;
    const joven2Id = jovenResult.rows[1].id;
    const joven3Id = jovenResult.rows[2].id;
    console.log('✓ Jóvenes creados');

    // 5. Crear pagos de prueba
    await client.query(`
      INSERT INTO pagos (joven_id, plazo_numero, cantidad, pagado, registrado_por)
      VALUES 
        ($1, 1, 50.00, true, $4),
        ($1, 2, 50.00, false, $4),
        ($2, 1, 50.00, true, $4),
        ($3, 1, 33.33, true, $5)
    `, [joven1Id, joven2Id, joven3Id, monitor1Id, monitor2Id]);

    console.log('✓ Pagos creados');

    console.log('\n✅ Seed completado exitosamente');
    console.log('\nCredenciales de prueba:');
    console.log('  Email: monitor1@example.com');
    console.log('  Email: monitor2@example.com');
    console.log('  Email: admin@example.com');
    console.log('  Contraseña: password123');

  } catch (err) {
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seed().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = seed;
