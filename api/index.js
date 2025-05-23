// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static(path.join(__dirname, '../public')));

// Подключаем роуты
const usersRoutes = require('./users');
app.use('/api/users', usersRoutes);

// Тестовый эндпоинт
app.get('/api/test-connect', (req, res) => {
  res.json({ status: "Сервер работает!" });
});

module.exports = app;