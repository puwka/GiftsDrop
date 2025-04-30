const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Пополнение баланса
router.post('/deposit', async (req, res) => {
    try {
        const { user_id, amount, method, promo_code } = req.body;
        
        // Проверяем пользователя
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1',
            [user_id]
        );
        
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        let bonusAmount = 0;
        
        // Проверяем промокод, если он есть
        if (promo_code) {
            const promoCheck = await pool.query(
                'SELECT * FROM promo_codes WHERE code = $1 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR uses_left > 0)',
                [promo_code.toUpperCase()]
            );
            
            if (promoCheck.rows.length > 0) {
                const promo = promoCheck.rows[0];
                bonusAmount = promo.amount;
                
                // Уменьшаем количество использований
                await pool.query(
                    'UPDATE promo_codes SET uses_left = uses_left - 1 WHERE code = $1',
                    [promo_code.toUpperCase()]
                );
                
                // Записываем использование промокода
                await pool.query(
                    'INSERT INTO used_promo_codes (user_id, promo_code) VALUES ($1, $2)',
                    [user_id, promo_code.toUpperCase()]
                );
            }
        }
        
        const totalAmount = amount + bonusAmount;
        
        // Обновляем баланс
        await pool.query(
            'UPDATE user_balances SET balance = balance + $1 WHERE user_id = $2',
            [totalAmount, user_id]
        );
        
        // Записываем транзакцию
        const transaction = await pool.query(
            'INSERT INTO transactions (user_id, amount, type, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [user_id, totalAmount, 'deposit', `Deposit via ${method}${bonusAmount > 0 ? ` (+${bonusAmount} from promo)` : ''}`]
        );
        
        // Получаем обновленный баланс
        const balanceResult = await pool.query(
            'SELECT balance FROM user_balances WHERE user_id = $1',
            [user_id]
        );
        
        res.json({
            transaction: transaction.rows[0],
            new_balance: balanceResult.rows[0].balance,
            bonus_received: bonusAmount
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// История транзакций
router.get('/history/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        
        const history = await pool.query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
            [user_id]
        );
        
        res.json(history.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;