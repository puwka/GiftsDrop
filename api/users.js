// users.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db');

// Получение или создание пользователя
router.post('/auth', async (req, res) => {
    console.log('Получены данные:', req.body);
    console.log('Получен запрос на /auth. Headers:', req.headers);
    console.log('Тело запроса:', req.body); // Важно: убедитесь, что тело парсится

    if (!req.body || Object.keys(req.body).length === 0) {
        console.error('Пустое тело запроса');
        return res.status(400).json({ error: 'Тело запроса отсутствует или пустое' });
    }
    
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

// Добавьте в users.js
router.get('/test', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT NOW() as time');
      res.json({ time: rows[0].time });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;