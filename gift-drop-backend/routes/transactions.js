const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// Пополнение баланса через TON
router.post('/deposit/ton', async (req, res) => {
    const { userId, amount, promoCode } = req.body;
    
    if (!userId || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Проверяем промокод
            let bonusAmount = 0;
            if (promoCode && PROMO_CODES[promoCode] && !PROMO_CODES[promoCode].used) {
                bonusAmount = PROMO_CODES[promoCode].amount;
                // Помечаем промокод как использованный
                await client.query(
                    'INSERT INTO used_promo_codes (user_id, promo_code) VALUES ($1, $2)',
                    [userId, promoCode]
                );
            }
            
            // 2. Рассчитываем сумму пополнения (1 TON = 200 GiftCoin)
            const depositAmount = Math.floor(amount * 200);
            const totalAmount = depositAmount + bonusAmount;
            
            // 3. Обновляем баланс
            await client.query(
                'UPDATE user_balances SET balance = balance + $1 WHERE user_id = $2',
                [totalAmount, userId]
            );
            
            // 4. Записываем транзакцию
            await client.query(
                `INSERT INTO transactions 
                (user_id, type, amount, currency, bonus_amount, promo_code)
                VALUES ($1, 'deposit', $2, 'TON', $3, $4)`,
                [userId, depositAmount, bonusAmount, promoCode || null]
            );
            
            // 5. Получаем новый баланс
            const balanceResult = await client.query(
                'SELECT balance FROM user_balances WHERE user_id = $1',
                [userId]
            );
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                new_balance: balanceResult.rows[0].balance,
                bonus_received: bonusAmount
            });
            
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Transaction error:', err);
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error processing TON deposit:', err);
        res.status(500).json({ 
            error: 'Internal server error',
            details: err.message
        });
    }
});

// Аналогично можно добавить обработку пополнения звездами и другие операции

const PROMO_CODES = {
    "WELCOME": { amount: 100 },
    "GIFT100": { amount: 100 },
    "BONUS50": { amount: 50 }
};

module.exports = router;