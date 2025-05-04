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

// Добавляем в users.js
router.get('/cases', async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM cases ORDER BY price ASC'
        );
        res.json({ cases: rows });
    } catch (err) {
        console.error('Ошибка при получении кейсов:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

router.get('/case/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const caseData = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
        
        if (caseData.rows.length === 0) {
            return res.status(404).json({ error: 'Case not found' });
        }
        
        const items = await pool.query(
            `SELECT i.* FROM cases_items ci
             JOIN items i ON ci.item_id = i.id
             WHERE ci.case_id = $1`,
            [id]
        );
        
        res.json({
            success: true,
            case: caseData.rows[0],
            items: items.rows
        });
    } catch (err) {
        console.error('Error getting case:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/open-case', async (req, res) => {
    console.log('Open case request received:', req.body);
    
    const { user_id, case_id, item_id, is_demo = false } = req.body;
    
    // Базовая валидация
    if (!user_id || !case_id || !item_id) {
        return res.status(400).json({ 
            success: false,
            error: 'user_id, case_id and item_id are required'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Проверка существования кейса и предмета
        const [caseResult, itemResult] = await Promise.all([
            client.query('SELECT id, price FROM cases WHERE id = $1', [case_id]),
            client.query('SELECT * FROM items WHERE id = $1', [item_id])
        ]);
        
        if (caseResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Case not found'
            });
        }
        
        if (itemResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Item not found'
            });
        }
        
        const caseData = caseResult.rows[0];
        const itemData = itemResult.rows[0];
        
        // 2. Для реального открытия - проверка баланса
        if (!is_demo) {
            const balanceResult = await client.query(
                'SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
                [user_id]
            );
            
            if (balanceResult.rows.length === 0 || balanceResult.rows[0].balance < caseData.price) {
                return res.status(400).json({
                    success: false,
                    error: 'Not enough balance'
                });
            }
            
            // Списание средств
            await client.query(
                'UPDATE user_balances SET balance = balance - $1 WHERE user_id = $2',
                [caseData.price, user_id]
            );
            
            // Запись транзакции
            await client.query(
                `INSERT INTO transactions 
                 (user_id, amount, type, description, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [user_id, -caseData.price, 'case_open', `Открытие кейса ${case_id}`]
            );
        }
        
        // 3. Записываем открытие (только для реальных открытий)
        if (!is_demo) {
            await client.query(
                `INSERT INTO cases_openings 
                 (user_id, case_id, item_id, is_demo, opened_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [user_id, case_id, item_id, is_demo]
            );
        }
        
        await client.query('COMMIT');
        
        // Успешный ответ
        res.json({
            success: true,
            item: itemData,
            price: is_demo ? 0 : caseData.price
        });
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Database error:', err);
        
        res.status(500).json({
            success: false,
            error: 'Database operation failed',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } finally {
        client.release();
    }
});

router.get('/case/:id/items', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Получаем предметы с их шансами для конкретного кейса
        const { rows } = await pool.query(`
            SELECT i.*, ci.adjusted_chance 
            FROM cases_items ci
            JOIN items i ON ci.item_id = i.id
            WHERE ci.case_id = $1
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No items found for this case' });
        }
        
        res.json({
            success: true,
            items: rows
        });
    } catch (err) {
        console.error('Error getting case items:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

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