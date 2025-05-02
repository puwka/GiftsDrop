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
            
            const response = {
                success: true,
                user: userData.rows[0] || null,
                balance: (balanceData.rows[0] && balanceData.rows[0].balance) || 0,
                level: (levelData.rows[0] && levelData.rows[0].level) || 1,
                xp: (levelData.rows[0] && levelData.rows[0].xp) || 0
            };

            res.json(response);
            
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

// Эндпоинт для работы с балансом
router.post('/balance', async (req, res) => {
    try {
        const { user_id, amount, type = 'deposit', description = 'Пополнение баланса' } = req.body;
        
        if (!user_id || amount === undefined) {
            return res.status(400).json({ error: 'user_id and amount are required' });
        }

        if (typeof amount !== 'number') {
            return res.status(400).json({ error: 'amount must be a number' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Проверяем существование пользователя
            const userExists = await client.query(
                'SELECT id FROM users WHERE id = $1',
                [user_id]
            );
            
            if (userExists.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // 2. Получаем текущий баланс
            const currentBalance = await client.query(
                'SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
                [user_id]
            );
            
            let newBalance;
            if (currentBalance.rows.length === 0) {
                // Если записи о балансе нет - создаем
                newBalance = amount;
                await client.query(
                    'INSERT INTO user_balances (user_id, balance, updated_at) VALUES ($1, $2, NOW())',
                    [user_id, newBalance]
                );
            } else {
                // Если запись есть - обновляем
                newBalance = currentBalance.rows[0].balance + amount;
                await client.query(
                    'UPDATE user_balances SET balance = $1, updated_at = NOW() WHERE user_id = $2',
                    [newBalance, user_id]
                );
            }
            
            // 3. Записываем транзакцию
            await client.query(
                `INSERT INTO transactions 
                 (user_id, amount, type, description, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [user_id, amount, type, description]
            );
            
            await client.query('COMMIT');
            
            return res.json({
                success: true,
                new_balance: newBalance
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

// Эндпоинт для получения истории транзакций
router.get('/transactions/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        
        const { rows } = await pool.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [user_id]
        );
        
        res.json({
            success: true,
            transactions: rows
        });
    } catch (err) {
        console.error('Ошибка при получении транзакций:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

// Получение информации о кейсе
router.get('/case/:case_id', async (req, res) => {
    try {
        const { case_id } = req.params;
        
        const client = await pool.connect();
        try {
            // Получаем информацию о кейсе
            const caseQuery = await client.query(
                'SELECT * FROM cases WHERE id = $1',
                [case_id]
            );
            
            if (caseQuery.rows.length === 0) {
                return res.status(404).json({ error: 'Case not found' });
            }
            
            // Получаем предметы в этом кейсе
            const itemsQuery = await client.query(
                `SELECT i.*, ci.adjusted_chance 
                 FROM items i
                 JOIN cases_items ci ON i.id = ci.item_id
                 WHERE ci.case_id = $1`,
                [case_id]
            );
            
            res.json({
                success: true,
                case: caseQuery.rows[0],
                items: itemsQuery.rows
            });
            
        } catch (err) {
            console.error('Error getting case:', err);
            res.status(500).json({ 
                error: 'Internal server error',
                details: err.message
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error in /case:', err.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

// Открытие кейса
router.post('/open-case', async (req, res) => {
    try {
        const { user_id, case_id, count = 1, is_demo = false } = req.body;
        
        if (!user_id || !case_id) {
            return res.status(400).json({ error: 'user_id and case_id are required' });
        }
        
        if (count < 1 || count > 3) {
            return res.status(400).json({ error: 'count must be between 1 and 3' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Проверяем существование пользователя
            const userExists = await client.query(
                'SELECT id FROM users WHERE id = $1',
                [user_id]
            );
            
            if (userExists.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // 2. Проверяем существование кейса
            const caseExists = await client.query(
                'SELECT * FROM cases WHERE id = $1',
                [case_id]
            );
            
            if (caseExists.rows.length === 0) {
                return res.status(404).json({ error: 'Case not found' });
            }
            
            const caseData = caseExists.rows[0];
            
            // 3. Для реального открытия проверяем баланс
            if (!is_demo) {
                const balanceQuery = await client.query(
                    'SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
                    [user_id]
                );
                
                if (balanceQuery.rows.length === 0 || balanceQuery.rows[0].balance < caseData.price * count) {
                    return res.status(400).json({ error: 'Not enough balance' });
                }
                
                // Списываем средства
                await client.query(
                    'UPDATE user_balances SET balance = balance - $1 WHERE user_id = $2',
                    [caseData.price * count, user_id]
                );
                
                // Записываем транзакцию
                await client.query(
                    `INSERT INTO transactions 
                     (user_id, amount, type, description, created_at)
                     VALUES ($1, $2, 'case', $3, NOW())`,
                    [user_id, -caseData.price * count, `Открытие кейса ${caseData.name} (x${count})`]
                );
            }
            
            // 4. Получаем предметы кейса с их шансами
            const itemsQuery = await client.query(
                `SELECT i.*, ci.adjusted_chance 
                 FROM items i
                 JOIN cases_items ci ON i.id = ci.item_id
                 WHERE ci.case_id = $1`,
                [case_id]
            );
            
            if (itemsQuery.rows.length === 0) {
                return res.status(400).json({ error: 'No items in this case' });
            }
            
            // 5. Генерируем выигрыши (для демо подкручиваем шансы)
            const wonItems = [];
            const totalItems = is_demo ? 
                adjustDemoChances(itemsQuery.rows) : 
                itemsQuery.rows;
            
            for (let i = 0; i < count; i++) {
                const wonItem = getRandomItem(totalItems);
                wonItems.push(wonItem);
                
                // Записываем открытие в базу
                await client.query(
                    `INSERT INTO cases_openings 
                     (user_id, case_id, item_id, is_demo, opened_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    [user_id, case_id, wonItem.id, is_demo]
                );
            }
            
            await client.query('COMMIT');
            
            return res.json({
                success: true,
                won_items: wonItems,
                new_balance: is_demo ? null : (balanceQuery.rows[0].balance - caseData.price * count)
            });
            
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Error opening case:', err);
            res.status(500).json({ 
                error: 'Transaction error',
                details: err.message
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error in /open-case:', err.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

// Вспомогательные функции
function getRandomItem(items) {
    const total = items.reduce((sum, item) => sum + parseFloat(item.adjusted_chance), 0);
    let random = Math.random() * total;
    
    for (const item of items) {
        random -= parseFloat(item.adjusted_chance);
        if (random <= 0) {
            return item;
        }
    }
    
    return items[items.length - 1];
}

function adjustDemoChances(items) {
    // Подкручиваем шансы для демо-режима - увеличиваем шансы редких предметов
    return items.map(item => {
        let multiplier = 1;
        if (item.rarity === 'legendary') multiplier = 5;
        else if (item.rarity === 'epic') multiplier = 3;
        else if (item.rarity === 'rare') multiplier = 2;
        
        return {
            ...item,
            adjusted_chance: parseFloat(item.adjusted_chance) * multiplier
        };
    });
}

module.exports = router;

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