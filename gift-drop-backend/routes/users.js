// users.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Получение или создание пользователя
router.post('/auth', async (req, res) => {
    console.log('Получены данные:', req.body);
    
    try {
        if (!req.body.telegram_id) {
            return res.status(400).json({ error: 'telegram_id is required' });
        }

        const { telegram_id, username, first_name, last_name, photo_url, language_code } = req.body;
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Проверяем существование пользователя
            const userCheck = await client.query(
                'SELECT id FROM users WHERE telegram_id = $1 FOR UPDATE',
                [telegram_id]
            );
            
            let userId;
            
            if (userCheck.rows.length === 0) {
                console.log('Создаем нового пользователя');
                const newUser = await client.query(
                    `INSERT INTO users 
                    (telegram_id, username, first_name, last_name, photo_url, language_code, created_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, NOW()) 
                    RETURNING id`,
                    [
                        telegram_id,
                        username || null,
                        first_name || null,
                        last_name || null,
                        photo_url || null,
                        language_code || 'ru'
                    ]
                );
                
                userId = newUser.rows[0].id;
                
                // Инициализируем баланс и уровень
                await Promise.all([
                    client.query(
                        'INSERT INTO user_balances (user_id, balance) VALUES ($1, 1000)',
                        [userId]
                    ),
                    client.query(
                        'INSERT INTO user_levels (user_id, level, xp) VALUES ($1, 1, 0)',
                        [userId]
                    )
                ]);
                
                console.log('Новый пользователь создан:', userId);
            } else {
                userId = userCheck.rows[0].id;
                console.log('Пользователь уже существует:', userId);
            }
            
            // Получаем данные пользователя
            const [userData, balanceData, levelData] = await Promise.all([
                client.query('SELECT * FROM users WHERE id = $1', [userId]),
                client.query('SELECT balance FROM user_balances WHERE user_id = $1', [userId]),
                client.query('SELECT level, xp FROM user_levels WHERE user_id = $1', [userId])
            ]);
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                user: userData.rows[0],
                balance: balanceData.rows[0].balance,
                level: levelData.rows[0].level,
                xp: levelData.rows[0].xp
            });
            
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Ошибка транзакции:', err);
            res.status(500).json({ 
                error: 'Transaction error',
                details: err.message
            });
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

// Обновление баланса
router.post('/balance', async (req, res) => {
    try {
        const { user_id, amount } = req.body;
        
        if (!user_id || amount === undefined) {
            return res.status(400).json({ error: 'user_id and amount are required' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Проверяем существование пользователя
            const userExists = await client.query(
                'SELECT 1 FROM users WHERE id = $1',
                [user_id]
            );
            
            if (userExists.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Обновляем баланс
            const result = await client.query(
                `UPDATE user_balances 
                 SET balance = balance + $1 
                 WHERE user_id = $2 
                 RETURNING balance`,
                [amount, user_id]
            );
            
            // Записываем транзакцию
            await client.query(
                `INSERT INTO transactions 
                 (user_id, amount, type, description, created_at) 
                 VALUES ($1, $2, $3, $4, NOW())`,
                [
                    user_id,
                    amount,
                    amount > 0 ? 'deposit' : 'withdraw',
                    amount > 0 ? 'Пополнение баланса' : 'Списание средств'
                ]
            );
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                new_balance: result.rows[0].balance
            });
            
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Ошибка транзакции:', err);
            res.status(500).json({ 
                error: 'Transaction error',
                details: err.message
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Ошибка в /balance:', err.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

module.exports = router;