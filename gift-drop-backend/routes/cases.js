const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Открытие кейса
router.post('/open', async (req, res) => {
    const { userId, caseType, price } = req.body;
    
    if (!userId || !caseType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Проверяем баланс пользователя
            const balanceResult = await client.query(
                'SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE',
                [userId]
            );
            
            if (balanceResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const currentBalance = balanceResult.rows[0].balance;
            
            if (currentBalance < price) {
                return res.status(400).json({ error: 'Insufficient funds' });
            }
            
            // 2. Вычитаем стоимость кейса
            const newBalance = currentBalance - price;
            await client.query(
                'UPDATE user_balances SET balance = $1 WHERE user_id = $2',
                [newBalance, userId]
            );
            
            // 3. Генерируем приз (здесь должна быть ваша логика определения приза)
            const prizeAmount = calculatePrize(caseType);
            const prizeDescription = getPrizeDescription(prizeAmount);
            
            // 4. Добавляем приз на баланс
            await client.query(
                'UPDATE user_balances SET balance = balance + $1 WHERE user_id = $2',
                [prizeAmount, userId]
            );
            
            // 5. Добавляем XP пользователю
            const xpToAdd = 10; // Например, 10 XP за открытие кейса
            await client.query(
                'UPDATE user_levels SET xp = xp + $1 WHERE user_id = $2',
                [xpToAdd, userId]
            );
            
            // 6. Проверяем, повысился ли уровень
            const levelResult = await client.query(
                'SELECT level, xp FROM user_levels WHERE user_id = $1',
                [userId]
            );
            
            const { level, xp } = levelResult.rows[0];
            const nextLevel = LEVELS.find(l => l.level === level + 1);
            let leveledUp = false;
            
            if (nextLevel && xp >= nextLevel.xpRequired) {
                await client.query(
                    'UPDATE user_levels SET level = level + 1 WHERE user_id = $1',
                    [userId]
                );
                leveledUp = true;
            }
            
            // 7. Записываем транзакцию
            await client.query(
                `INSERT INTO case_transactions 
                (user_id, case_type, price, prize_amount, prize_description)
                VALUES ($1, $2, $3, $4, $5)`,
                [userId, caseType, price, prizeAmount, prizeDescription]
            );
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                new_balance: newBalance + prizeAmount,
                prize_description: prizeDescription,
                leveled_up: leveledUp
            });
            
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Transaction error:', err);
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error opening case:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

function calculatePrize(caseType) {
    // Ваша логика расчета приза в зависимости от типа кейса
    switch (caseType) {
        case 'mix': return Math.floor(Math.random() * 200) + 50;
        case 'premium': return Math.floor(Math.random() * 500) + 200;
        case 'legendary': return Math.floor(Math.random() * 1000) + 500;
        default: return 0;
    }
}

function getPrizeDescription(amount) {
    if (amount < 100) return `Обычный приз (${amount} 🪙)`;
    if (amount < 300) return `Редкий приз (${amount} 🪙)`;
    if (amount < 700) return `Эпический приз (${amount} 🪙)`;
    return `Легендарный приз (${amount} 🪙)`;
}

const LEVELS = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 300 },
    { level: 4, xpRequired: 600 },
    { level: 5, xpRequired: 1000 }
];

module.exports = router;