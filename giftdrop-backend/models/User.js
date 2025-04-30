const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId: { type: Number, unique: true },
  name: String,
  username: String,
  balance: { type: Number, default: 1000 },
  deposits: { type: Number, default: 0 },
  openedCases: { type: Number, default: 0 },
  bonuses: [{
    type: { type: String },
    value: Number,
    expiresAt: Date
  }],
  lastActivity: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);