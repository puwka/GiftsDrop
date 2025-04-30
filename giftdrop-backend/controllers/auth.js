exports.auth = async (req, res) => {
    console.log('Auth request received'); // Логирование
    
    try {
      const { initData } = req.body;
      console.log('InitData:', initData); // Логирование
  
      const userData = validateTelegramData(initData);
      console.log('UserData:', userData); // Логирование
  
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
  
      console.log('User created/updated:', user); // Логирование
      
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
      res.status(400).json({ 
        error: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  };