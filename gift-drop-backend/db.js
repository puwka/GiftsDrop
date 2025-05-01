const { Pool } = require('pg');

console.log('Connecting to database at:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Проверка подключения
pool.query('SELECT NOW()')
  .then(() => console.log('Database connection successful'))
  .catch(err => console.error('Database connection error:', err));

module.exports = { pool };