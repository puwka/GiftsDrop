require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['https://gifts-drop.vercel.app', 'https://gift-drop.vercel.app'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Подключаем роуты
const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes);

// Тестовый эндпоинт (убедитесь, что API работает)
app.get('/api/test', (req, res) => {
  res.json({ status: "API работает!" });
});

// Обработка 404 (если роут не найден)
app.use((req, res) => {
  res.status(404).json({ error: "Эндпоинт не найден" });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});