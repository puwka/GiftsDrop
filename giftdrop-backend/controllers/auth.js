const User = require('../models/User');

exports.auth = async (req, res) => {
  const { initData } = req.body;
  
  try {
    // Валидация данных Telegram
    const userData = validateTelegramData(initData);
    
    // Поиск или создание пользователя
    const user = await User.findOneAndUpdate(
      { telegramId: userData.id },
      {
        $set: {
          name: `${userData.first_name} ${userData.last_name || ''}`,
          username: userData.username,
          lastActivity: new Date()
        },
        $setOnInsert: { balance: 1000 }
      },
      { upsert: true, new: true }
    );
    
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};