require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

console.log("Текущее окружение:", {
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: process.env.PORT
  });

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

// API routes will be added here
// Подключаем маршруты
const usersRoutes = require('./routes/users');
const casesRoutes = require('./routes/cases');
const bonusesRoutes = require('./routes/bonuses');
const transactionsRoutes = require('./routes/transactions');

app.use('/api/users', usersRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/bonuses', bonusesRoutes);
app.use('/api/transactions', transactionsRoutes);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = app;