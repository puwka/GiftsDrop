const User = require('../models/User');
const crypto = require('crypto');

function validateTelegramData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const dataToCheck = [];
  
  params.sort();
  params.forEach((val, key) => {
    if (key !== 'hash') {
      dataToCheck.push(`${key}=${val}`);
    }
  });
  
  const secretKey = crypto.createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
  
  const computedHash = crypto.createHmac('sha256', secretKey)
    .update(dataToCheck.join('\n'))
    .digest('hex');
    
  if (computedHash !== hash) {
    throw new Error('Invalid Telegram data');
  }
  
  return JSON.parse(params.get('user'));
}

exports.auth = async (req, res) => {
  const { initData } = req.body;
  
  try {
    const userData = validateTelegramData(initData);
    
    const user = await User.findOneAndUpdate(
      { telegramId: userData.id },
      {
        $set: {
          name: `${userData.first_name} ${userData.last_name || ''}`.trim(),
          username: userData.username,
          photo_url: userData.photo_url,
          lastActivity: new Date()
        },
        $setOnInsert: { 
          balance: 1000,
          level: 1,
          xp: 0,
          dailySpins: 1,
          deposits: 0,
          bonuses: []
        }
      },
      { upsert: true, new: true }
    );
    
    res.json({
      _id: user._id,
      telegramId: user.telegramId,
      name: user.name,
      photo_url: user.photo_url,
      balance: user.balance,
      level: user.level,
      xp: user.xp,
      dailySpins: user.dailySpins,
      deposits: user.deposits,
      bonuses: user.bonuses
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(400).json({ error: err.message });
  }
};