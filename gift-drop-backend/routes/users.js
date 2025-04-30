const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Получение или создание пользователя
router.post('/auth', async (req, res) => {
    console.log('Получены данные:', req.body); // Логируем входящие данные
    
    try {
        // Проверка обязательных полей
        if (!req.body.telegram_id) {
            return res.status(400).json({ error: 'telegram_id is required' });
        }

        const { telegram_id, username, first_name, last_name, photo_url, language_code } = req.body;
        
        // Начинаем транзакцию
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Проверяем существование пользователя
            const userCheck = await client.query(
                'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
                [telegram_id]
            );
            
            let user;
            
            if (userCheck.rows.length === 0) {
                console.log('Создаем нового пользователя');
                // Создаем нового пользователя
                const newUser = await client.query(
                    `INSERT INTO users 
                    (telegram_id, username, first_name, last_name, photo_url, language_code) 
                    VALUES ($1, $2, $3, $4, $5, $6) 
                    RETURNING *`,
                    [
                        telegram_id,
                        username || null,
                        first_name || null,
                        last_name || null,
                        photo_url || null,
                        language_code || null
                    ]
                );
                
                // Создаем баланс для пользователя
                await client.query(
                    'INSERT INTO user_balances (user_id, balance) VALUES ($1, 1000)',
                    [newUser.rows[0].id]
                );
                
                // Создаем запись о прогрессе уровней
                await client.query(
                    'INSERT INTO user_levels (user_id, level, xp) VALUES ($1, 1, 0)',
                    [newUser.rows[0].id]
                );
                
                user = newUser.rows[0];
                console.log('Новый пользователь создан:', user.id);
            } else {
                user = userCheck.rows[0];
                console.log('Пользователь уже существует:', user.id);
            }
            
            // Получаем полные данные пользователя
            const [balance, level] = await Promise.all([
                client.query('SELECT balance FROM user_balances WHERE user_id = $1', [user.id]),
                client.query('SELECT level, xp FROM user_levels WHERE user_id = $1', [user.id])
            ]);
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                user,
                balance: balance.rows[0].balance,
                level: level.rows[0].level,
                xp: level.rows[0].xp
            });
            
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Ошибка транзакции:', err);
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Ошибка в /auth:', err.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

module.exports = router;