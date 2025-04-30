require('dotenv').config();

// Добавьте перед маршрутами
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    if (req.headers['tg-webapp-data']) {
      console.log('Telegram WebApp Data:', req.headers['tg-webapp-data']);
    }
    next();
  });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

const app = express();

// Настройки CORS
app.use(cors({
  origin: ['https://gifts-drop.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Подключение к MongoDB
mongoose.connect(process.env.DB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Маршруты
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Тестовый эндпоинт для проверки работы
app.get('/api/test', (req, res) => {
  res.json({ status: 'API работает' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});