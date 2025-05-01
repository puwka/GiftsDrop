require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Подключаем роуты
const usersRoutes = require('./users');
const casesRoutes = require('./cases');
app.use('/api/users', usersRoutes);
app.use('/api/balance', usersRoutes);
app.use('/transactions/:user_id', usersRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api//cases/:id/items', casesRoutes);
app.use('/api/cases/:id/open', casesRoutes);

// Тестовый эндпоинт
app.get('/api/test-connect', (req, res) => {
  res.json({ status: "Сервер работает!" });
});

module.exports = app;