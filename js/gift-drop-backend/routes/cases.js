const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Открытие кейса
router.post('/open', async (req, res) => {
    try {
        const { user_id, case_type } = req.body;
        
        // Определяем стоимость кейса
        let casePrice = 0;
        switch (case_type) {
            case 'mix': casePrice = 0; break;
            case 'premium': casePrice = 500; break;
            case 'legendary': casePrice = 1000; break;
            default: return res.status(400).json({ msg: 'Invalid case type' });
        }
        
        // Проверяем баланс пользователя
        const balanceResult = await pool.query(
            'SELECT balance FROM user_balances WHERE user_id = $1',
            [user_id]
        );
        
        if (balanceResult.rows.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        const currentBalance = balanceResult.rows[0].balance;
        
        if (currentBalance < casePrice) {
            return res.status(400).json({ msg: 'Not enough balance' });
        }
        
        // Генерируем приз (упрощенная логика)
        let prizeValue, prizeDescription;
        if (case_type === 'mix') {
            prizeValue = Math.floor(Math.random() * 50) + 10;
            prizeDescription = 'Common prize';
        } else if (case_type === 'premium') {
            prizeValue = Math.floor(Math.random() * 200) + 50;
            prizeDescription = 'Premium prize';
        } else {
            prizeValue = Math.floor(Math.random() * 500) + 200;
            prizeDescription = 'Legendary prize';
        }
        
        // Обновляем баланс пользователя (если кейс не бесплатный)
        if (casePrice > 0) {
            await pool.query(
                'UPDATE user_balances SET balance = balance - $1 WHERE user_id = $2',
                [casePrice, user_id]
            );
        }
        
        // Добавляем приз к балансу
        await pool.query(
            'UPDATE user_balances SET balance = balance + $1 WHERE user_id = $2',
            [prizeValue, user_id]
        );
        
        // Записываем открытие кейса
        const openedCase = await pool.query(
            'INSERT INTO opened_cases (user_id, case_type, prize_value, prize_description) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id, case_type, prizeValue, prizeDescription]
        );
        
        // Добавляем XP пользователю
        let xpReward = 0;
        switch (case_type) {
            case 'mix': xpReward = 10; break;
            case 'premium': xpReward = 25; break;
            case 'legendary': xpReward = 50; break;
        }
        
        await pool.query(
            'UPDATE user_levels SET xp = xp + $1 WHERE user_id = $2',
            [xpReward, user_id]
        );
        
        // Проверяем, повысился ли уровень
        const levelResult = await pool.query(
            'SELECT level, xp FROM user_levels WHERE user_id = $1',
            [user_id]
        );
        
        const { level, xp } = levelResult.rows[0];
        let leveledUp = false;
        let newLevel = level;
        
        // Простая логика повышения уровня (100 XP на уровень)
        if (xp >= level * 100) {
            newLevel = level + 1;
            await pool.query(
                'UPDATE user_levels SET level = $1 WHERE user_id = $2',
                [newLevel, user_id]
            );
            leveledUp = true;
        }
        
        // Получаем обновленный баланс
        const updatedBalance = await pool.query(
            'SELECT balance FROM user_balances WHERE user_id = $1',
            [user_id]
        );
        
        res.json({
            case: openedCase.rows[0],
            prize_value: prizeValue,
            prize_description: prizeDescription,
            new_balance: updatedBalance.rows[0].balance,
            xp_gained: xpReward,
            current_level: newLevel,
            current_xp: xp,
            leveled_up: leveledUp
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// История открытых кейсов
router.get('/history/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        
        const history = await pool.query(
            'SELECT * FROM opened_cases WHERE user_id = $1 ORDER BY opened_at DESC LIMIT 20',
            [user_id]
        );
        
        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;