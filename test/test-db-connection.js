#!/usr/bin/env node
require('dotenv').config({ path: './backend/.env' });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
const dbSchema = process.env.DB_SCHEMA;

const client = new Client({ connectionString });

(async () => {
  try {
    await client.connect();
    const versionResult = await client.query('SELECT version();');
    console.log('PostgreSQL:', versionResult.rows[0].version);

    const schemaResult = await client.query(
      'SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1;',
      [dbSchema]
    );

    if (!schemaResult.rows.length) {
      throw new Error(`Schema ${dbSchema} no existe`);
    }

    console.log(`Schema ${dbSchema} OK`);
  } catch (error) {
    console.error('DB Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
