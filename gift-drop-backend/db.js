const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  idleTimeoutMillis: 30000,
});
console.log('DB host:', new URL(process.env.DATABASE_URL).hostname); // Для отладки