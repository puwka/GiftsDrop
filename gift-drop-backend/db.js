const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'db.rsdbnpenxgzqvihqqfdp.supabase.co',
  database: 'postgres',
  password: 'Korol228',
  port: 5432,
  ssl: {
    require: true,
    rejectUnauthorized: false
  },
  // Явно указываем метод аутентификации
  authMethods: ['scram-sha-256']
});

// Тест подключения с простым запросом
pool.query('SELECT 1 AS test')
  .then(() => console.log('✅ Подключение успешно'))
  .catch(err => console.error('❌ Ошибка подключения:', err));

module.exports = { pool };