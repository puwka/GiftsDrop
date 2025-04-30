const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Крутить рулетку
router.post('/spin', async (req, res) => {
    try {
        const { user_id } = req.body;
        
        // Проверяем баланс пользователя (стоимость спина - 100)
        const balanceResult = await pool.query(
            'SELECT balance FROM user_balances WHERE user_id = $1',
            [user_id]
        );
        
        if (balanceResult.rows.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        const currentBalance = balanceResult.rows[0].balance;
        
        if (currentBalance < 100) {
            return res.status(400).json({ msg: 'Not enough balance for spin' });
        }
        
        // Обновляем баланс
        await pool.query(
            'UPDATE user_balances SET balance = balance - 100 WHERE user_id = $1',
            [user_id]
        );
        
        // Генерируем случайный бонус
        const bonusTypes = [
            { type: 'deposit', probability: 45 },
            { type: 'discount', probability: 35 },
            { type: 'free', probability: 20 }
        ];
        
        const random = Math.random() * 100;
        let cumulative = 0;
        let selectedType;
        
        for (const type of bonusTypes) {
            cumulative += type.probability;
            if (random <= cumulative) {
                selectedType = type.type;
                break;
            }
        }
        
        // Генерируем конкретный бонус
        let bonusTitle, bonusValue, durationHours;
        
        switch (selectedType) {
            case 'deposit':
                bonusTitle = Math.random() > 0.5 ? '+20% К ДЕПОЗИТУ' : '+15% К ДЕПОЗИТУ';
                bonusValue = bonusTitle.includes('20') ? 0.2 : 0.15;
                durationHours = bonusTitle.includes('20') ? 24 : 12;
                break;
            case 'discount':
                bonusTitle = Math.random() > 0.5 ? '-20% НА КЕЙСЫ' : '-15% НА КЕЙСЫ';
                bonusValue = bonusTitle.includes('20') ? 0.2 : 0.15;
                durationHours = bonusTitle.includes('20') ? 12 : 6;
                break;
            case 'free':
                bonusTitle = Math.random() > 5 ? '+2 ПОДАРКА' : '+1 ПОДАРОК';
                bonusValue = bonusTitle.includes('2') ? 2 : 1;
                durationHours = 0; // Одноразовый бонус
                break;
        }
        
        // Если бонус временный, сохраняем его
        if (durationHours > 0) {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + durationHours);
            
            await pool.query(
                'INSERT INTO user_bonuses (user_id, type, title, value, expires_at) VALUES ($1, $2, $3, $4, $5)',
                [user_id, selectedType, bonusTitle, bonusValue, expiresAt]
            );
        } else {
            // Для одноразовых бонусов сразу применяем их
            if (selectedType === 'free') {
                // Добавляем подарки к балансу
                await pool.query(
                    'UPDATE user_balances SET balance = balance + $1 WHERE user_id = $2',
                    [bonusValue * 100, user_id] // Предположим, что 1 подарок = 100 монет
                );
            }
        }
        
        // Добавляем XP за спин
        await pool.query(
            'UPDATE user_levels SET xp = xp + 15 WHERE user_id = $1',
            [user_id]
        );
        
        // Получаем обновленный баланс
        const updatedBalance = await pool.query(
            'SELECT balance FROM user_balances WHERE user_id = $1',
            [user_id]
        );
        
        res.json({
            bonus_type: selectedType,
            bonus_title: bonusTitle,
            bonus_value: bonusValue,
            duration_hours: durationHours,
            new_balance: updatedBalance.rows[0].balance
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Активные бонусы пользователя
router.get('/active/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        
        const now = new Date();
        
        const activeBonuses = await pool.query(
            'SELECT * FROM user_bonuses WHERE user_id = $1 AND expires_at > $2 AND is_active = true',
            [user_id, now]
        );
        
        res.json(activeBonuses.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Участие в розыгрыше
router.post('/giveaway', async (req, res) => {
    try {
        const { user_id, min_amount } = req.body;
        
        // Проверяем общую сумму депозитов пользователя
        const depositResult = await pool.query(
            'SELECT COALESCE(SUM(amount), 0) as total_deposits FROM transactions WHERE user_id = $1 AND type = $2',
            [user_id, 'deposit']
        );
        
        const totalDeposits = depositResult.rows[0].total_deposits || 0;
        
        if (totalDeposits < min_amount) {
            return res.status(400).json({ 
                msg: `You need to deposit at least ${min_amount} to participate`,
                required: min_amount,
                current: totalDeposits
            });
        }
        
        // Здесь можно добавить логику регистрации на розыгрыш
        // В этом примере просто возвращаем успех
        
        res.json({
            success: true,
            message: 'You have successfully joined the giveaway'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;