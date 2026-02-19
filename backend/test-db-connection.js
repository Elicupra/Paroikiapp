#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
const dbSchema = process.env.DB_SCHEMA;

console.log('🔍 Probando conexión a PostgreSQL...\n');
console.log(`📊 Base de datos: ${connectionString}`);
console.log(`📂 Schema: ${dbSchema}\n`);

const client = new Client({
  connectionString: connectionString,
});

(async () => {
  try {
    console.log('⏳ Conectando...');
    await client.connect();
    console.log('✅ ¡Conexión exitosa!\n');

    // Verificar versión de PostgreSQL
    const versionResult = await client.query('SELECT version();');
    console.log('📌 Versión PostgreSQL:');
    console.log(versionResult.rows[0].version);
    console.log();

    // Verificar si el schema existe
    const schemaResult = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1;",
      [dbSchema]
    );

    if (schemaResult.rows.length > 0) {
      console.log(`✅ Schema "${dbSchema}" existe\n`);

      // Listar tablas en el schema
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        ORDER BY table_name;
      `, [dbSchema]);

      if (tablesResult.rows.length > 0) {
        console.log(`📋 Tablas en schema "${dbSchema}":`);
        tablesResult.rows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.table_name}`);
        });
      } else {
        console.log(`⚠️  No hay tablas en el schema "${dbSchema}"`);
      }
    } else {
      console.log(`⚠️  Schema "${dbSchema}" NO existe`);
      console.log(`    Necesitas ejecutar: npm run migrate\n`);
    }

    // Verificar usuarios/roles
    const usersResult = await client.query('SELECT usename FROM pg_user;');
    console.log('\n👥 Usuarios en PostgreSQL:');
    usersResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.usename}`);
    });

  } catch (error) {
    console.error('❌ Error de conexión:\n');
    console.error(`   Tipo: ${error.code || error.name}`);
    console.error(`   Mensaje: ${error.message}`);
    console.error();
    
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Solución: Verifica que PostgreSQL esté ejecutándose en 192.168.1.10:5432');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Solución: Verifica que el host 192.168.1.10 sea accesible');
    } else if (error.code === '28P01') {
      console.error('💡 Solución: Verifica usuario/contraseña en DATABASE_URL');
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Conexión cerrada');
  }
})();
