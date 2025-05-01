const { Pool } = require('pg');

console.log("Используется DATABASE_URL:", process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Обязательно для внешних БД
});

// Тест подключения
pool.query('SELECT NOW()')
  .then(res => console.log("✅ PostgreSQL подключён. Время сервера:", res.rows[0].now))
  .catch(err => {
    console.error("❌ Ошибка подключения к PostgreSQL:", err.message);
    console.log("Проверьте:");
    console.log("1. Запущен ли сервер PostgreSQL");
    console.log("2. Правильность данных в .env файле");
    console.log("3. Доступность БД из командной строки:");
    console.log(`   psql "${process.env.DATABASE_URL}"`);
  });

module.exports = { pool };