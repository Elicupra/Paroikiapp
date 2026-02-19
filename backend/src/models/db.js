const { Pool } = require('pg');
require('dotenv').config();

// Crear un wrapper alrededor del pool para establecer search_path
class SchemaPool {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  async query(text, values) {
    const client = await this.pool.connect();
    try {
      const schema = process.env.DB_SCHEMA || 'paroikiapp';
      await client.query(`SET search_path TO ${schema};`);
      return await client.query(text, values);
    } finally {
      client.release();
    }
  }

  async connect() {
    const client = await this.pool.connect();
    const schema = process.env.DB_SCHEMA || 'paroikiapp';
    await client.query(`SET search_path TO ${schema};`);
    return client;
  }

  end() {
    return this.pool.end();
  }
}

module.exports = new SchemaPool();
