require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Подключение к MongoDB
mongoose.connect(process.env.DB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Маршруты
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Проверка Telegram WebApp Data
app.use('/api', (req, res, next) => {
    if (!validateTelegramWebAppData(req.headers['tg-webapp-data'])) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  });