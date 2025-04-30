const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String },
  photo_url: { type: String },
  balance: { type: Number, default: 1000 },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  dailySpins: { type: Number, default: 1 },
  lastActivity: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);