const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Получение или создание пользователя
router.post('/auth', async (req, res) => {
    try {
        const { telegram_id, username, first_name, last_name, photo_url, language_code } = req.body;
        
        // Проверяем, существует ли пользователь
        const userCheck = await pool.query(
            'SELECT * FROM users WHERE telegram_id = $1',
            [telegram_id]
        );
        
        let user;
        
        if (userCheck.rows.length === 0) {
            // Создаем нового пользователя
            const newUser = await pool.query(
                'INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, language_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [telegram_id, username, first_name, last_name, photo_url, language_code]
            );
            
            // Создаем баланс для пользователя
            await pool.query(
                'INSERT INTO user_balances (user_id, balance) VALUES ($1, $2)',
                [newUser.rows[0].id, 1000] // Начальный баланс 1000
            );
            
            // Создаем запись о прогрессе уровней
            await pool.query(
                'INSERT INTO user_levels (user_id, level, xp) VALUES ($1, $2, $3)',
                [newUser.rows[0].id, 1, 0] // Начинаем с 1 уровня
            );
            
            user = newUser.rows[0];
        } else {
            user = userCheck.rows[0];
        }
        
        // Получаем баланс пользователя
        const balanceResult = await pool.query(
            'SELECT balance FROM user_balances WHERE user_id = $1',
            [user.id]
        );
        
        // Получаем прогресс уровней
        const levelResult = await pool.query(
            'SELECT level, xp FROM user_levels WHERE user_id = $1',
            [user.id]
        );
        
        res.json({
            user,
            balance: balanceResult.rows[0].balance,
            level: levelResult.rows[0].level,
            xp: levelResult.rows[0].xp
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Получение данных пользователя
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const user = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [id]
        );
        
        if (user.rows.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Получаем баланс пользователя
        const balanceResult = await pool.query(
            'SELECT balance FROM user_balances WHERE user_id = $1',
            [id]
        );
        
        // Получаем прогресс уровней
        const levelResult = await pool.query(
            'SELECT level, xp FROM user_levels WHERE user_id = $1',
            [id]
        );
        
        // Получаем статистику по кейсам
        const casesStats = await pool.query(
            'SELECT COUNT(*) as total_cases, MAX(prize_value) as best_prize FROM opened_cases WHERE user_id = $1',
            [id]
        );
        
        res.json({
            user: user.rows[0],
            balance: balanceResult.rows[0].balance,
            level: levelResult.rows[0].level,
            xp: levelResult.rows[0].xp,
            total_cases: casesStats.rows[0].total_cases,
            best_prize: casesStats.rows[0].best_prize || 0
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;