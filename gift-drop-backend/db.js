const { Pool } = require('pg');

// Конфигурация для Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Обязательно для Supabase
  },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Тест подключения
pool.query('SELECT NOW()')
  .then(res => console.log("✅ PostgreSQL подключён:", res.rows[0].now))
  .catch(err => {
    console.error("❌ Ошибка подключения:", err);
    console.log("Используемый DATABASE_URL:", process.env.DATABASE_URL); // Для отладки
  });

module.exports = { pool };