const { Pool } = require('pg');

console.log('Database host:', new URL(process.env.DATABASE_URL).hostname);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Тестовый запрос для проверки подключения
pool.query('SELECT NOW()')
  .then(res => console.log('Database connection successful:', res.rows[0]))
  .catch(err => console.error('Database connection failed:', err));

module.exports = { pool };