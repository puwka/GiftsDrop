const User = require('../models/User');

exports.getUser = async (req, res) => {
  try {
    const initData = req.headers['tg-webapp-data'];
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user'));
    
    const user = await User.findOne({ telegramId: userData.id });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      balance: user.balance,
      level: user.level,
      xp: user.xp,
      dailySpins: user.dailySpins,
      deposits: user.deposits,
      bonuses: user.bonuses
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.saveProgress = async (req, res) => {
  try {
    const initData = req.headers['tg-webapp-data'];
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user'));
    const { xp, level, dailySpins } = req.body;
    
    await User.findOneAndUpdate(
      { telegramId: userData.id },
      { xp, level, dailySpins }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Save progress error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.saveBonus = async (req, res) => {
  try {
    const initData = req.headers['tg-webapp-data'];
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user'));
    const { bonus } = req.body;
    
    await User.findOneAndUpdate(
      { telegramId: userData.id },
      { $push: { bonuses: bonus } }
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Save bonus error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.processDeposit = async (req, res) => {
  try {
    const initData = req.headers['tg-webapp-data'];
    const params = new URLSearchParams(initData);
    const userData = JSON.parse(params.get('user'));
    const { amount, currency } = req.body;
    
    const user = await User.findOneAndUpdate(
      { telegramId: userData.id },
      { 
        $inc: { balance: amount, deposits: amount },
        $set: { lastActivity: new Date() }
      },
      { new: true }
    );
    
    res.json({ balance: user.balance });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.resetStats = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      balance: 1000,
      deposits: 0,
      openedCases: 0,
      bonuses: []
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};