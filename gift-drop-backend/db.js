const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Важно для Supabase
  },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Тест подключения
pool.query('SELECT NOW()')
  .then(res => console.log("✅ PostgreSQL подключён:", res.rows[0].now))
  .catch(err => console.error("❌ Ошибка подключения:", err));

module.exports = { pool };