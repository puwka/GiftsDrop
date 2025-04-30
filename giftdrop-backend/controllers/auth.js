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

exports.initTelegramAuth = () => {
  if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
    return Telegram.WebApp.initData;
  }
  return null;
};

exports.getTestUserData = () => {
  return {
    id: Math.floor(Math.random() * 100000),
    name: 'Test User',
    photo: null
  };
};

exports.formatUserData = (user) => {
  return {
    id: user._id || user.id,
    name: user.name || 'Anonymous',
    photo: user.photo_url || null
  };
};

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
          dailySpins: 1 
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
      dailySpins: user.dailySpins
    });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(400).json({ error: err.message });
  }
};