require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Routes
app.get('/', (req, res) => {
    res.send('Gift Drop Backend API');
});

// Подключаем маршруты
const usersRoutes = require('./routes/users');
const casesRoutes = require('./routes/cases');
const bonusesRoutes = require('./routes/bonuses');
const transactionsRoutes = require('./routes/transactions');

app.use('/api/users', usersRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/bonuses', bonusesRoutes);
app.use('/api/transactions', transactionsRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;