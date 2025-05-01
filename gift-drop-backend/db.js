const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Добавьте эти параметры:
  application_name: 'gifts-drop-app',
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
  // Явно укажите метод аутентификации:
  sslmode: 'require'
});

// Тест подключения с простым запросом
pool.query('SELECT 1 AS test')
  .then(() => console.log('✅ Подключение успешно'))
  .catch(err => console.error('❌ Ошибка подключения:', err));

module.exports = { pool };