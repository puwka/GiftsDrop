const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres.rsdhnpcnxgzqvihqqfdp',
  host: 'aws-0-eu-north-1.pooler.supabase.com',
  database: 'postgres',
  password: process.env.DB_PASSWORD || '[Korol228]',
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
    // Добавьте дополнительные параметры SSL при необходимости
  },
  // Явно укажите используемый метод аутентификации
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

// Проверка подключения при старте
pool.on('connect', () => console.log('Connected to database'));
pool.on('error', (err) => console.error('Database error:', err));

module.exports = { pool };