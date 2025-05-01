// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Роуты
const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes);

// Тестовый эндпоинт
app.get('/api/test-connect', (req, res) => {
  res.json({ status: "Сервер работает!" });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// ⚠️ Удалите app.listen()! 
// Экспортируем app для Vercel
module.exports = app;