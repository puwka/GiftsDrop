const { Pool } = require('pg');
const { URL } = require('url');

// Парсинг URL для проверки
const dbUrl = new URL(process.env.DATABASE_URL);
console.log('Parsed DB connection details:', {
  user: dbUrl.username,
  host: dbUrl.hostname,
  port: dbUrl.port,
  database: dbUrl.pathname.slice(1)
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    // Дополнительные настройки для Supabase
    ca: process.env.DB_SSL_CA // Добавьте при необходимости
  },
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

// Расширенная диагностика подключения
pool.on('connect', (client) => {
  console.log('New client connection established');
  client.query('SELECT NOW()')
    .then(res => console.log('Connection test successful:', res.rows[0]))
    .catch(err => console.error('Connection test failed:', err));
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = { pool };