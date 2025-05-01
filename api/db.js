// db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Проверка подключения
pool.query('SELECT NOW()')
  .then(() => console.log('✅ База данных подключена'))
  .catch(err => console.error('❌ Ошибка подключения:', err));

module.exports = { pool };  // Важно: экспортируем pool