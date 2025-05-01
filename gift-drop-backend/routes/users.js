const express = require('express');
const router = express.Router();

// Эндпоинт /api/users/auth
router.post('/auth', async (req, res) => {
  try {
    console.log("Получен запрос на /auth:", req.body);
    res.json({ success: true, user: req.body });
  } catch (err) {
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

module.exports = router; // Важно!