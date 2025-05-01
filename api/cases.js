// Добавьте эти маршруты в ваш usersRoutes или создайте новый файл cases.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db');
// Получить все кейсы
router.get('/cases', async (req, res) => {
    try {
        const cases = await db.query('SELECT * FROM cases ORDER BY price');
        res.json(cases.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получить предметы в кейсе
router.get('/cases/:id/items', async (req, res) => {
    try {
        const items = await db.query(`
            SELECT i.*, ci.adjusted_chance 
            FROM case_items ci
            JOIN items i ON ci.item_id = i.id
            WHERE ci.case_id = $1
            ORDER BY i.price DESC
        `, [req.params.id]);
        res.json(items.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Открыть кейс
router.post('/cases/:id/open', async (req, res) => {
    const { user_id, is_demo = false, count = 1 } = req.body;
    
    try {
        // Проверяем баланс пользователя (если не демо)
        if (!is_demo) {
            const userBalance = await db.query('SELECT balance FROM user_balances WHERE user_id = $1', [user_id]);
            const caseInfo = await db.query('SELECT price FROM cases WHERE id = $1', [req.params.id]);
            
            if (userBalance.rows[0].balance < caseInfo.rows[0].price * count) {
                return res.status(400).json({ error: "Недостаточно средств" });
            }
        }

        // Получаем предметы кейса с их шансами
        const items = await db.query(`
            SELECT i.*, ci.adjusted_chance 
            FROM case_items ci
            JOIN items i ON ci.item_id = i.id
            WHERE ci.case_id = $1
        `, [req.params.id]);

        // Симулируем выпадение предметов
        const results = [];
        for (let i = 0; i < count; i++) {
            const item = weightedRandom(items.rows, is_demo);
            results.push(item);
            
            // Записываем в историю
            await db.query(`
                INSERT INTO case_openings (user_id, case_id, item_id, is_demo)
                VALUES ($1, $2, $3, $4)
            `, [user_id, req.params.id, item.id, is_demo]);
            
            // Обновляем баланс (если не демо)
            if (!is_demo) {
                await db.query(`
                    UPDATE user_balances 
                    SET balance = balance - $1
                    WHERE user_id = $2
                `, [caseInfo.rows[0].price, user_id]);
            }
        }

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Вспомогательная функция для взвешенного случайного выбора
function weightedRandom(items, isDemo = false) {
    // В демо-режиме увеличиваем шансы на редкие предметы
    const adjustedItems = items.map(item => ({
        ...item,
        adjusted_chance: isDemo ? 
            item.adjusted_chance * (item.rarity === 'legendary' ? 5 : 
                                  item.rarity === 'epic' ? 3 : 
                                  item.rarity === 'rare' ? 2 : 1) : 
            item.adjusted_chance
    }));

    const total = adjustedItems.reduce((sum, item) => sum + item.adjusted_chance, 0);
    let random = Math.random() * total;
    
    for (const item of adjustedItems) {
        if (random < item.adjusted_chance) return item;
        random -= item.adjusted_chance;
    }
    
    return adjustedItems[adjustedItems.length - 1];
}