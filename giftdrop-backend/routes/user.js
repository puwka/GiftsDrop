const express = require('express');
const router = express.Router();
const userController = require('../controllers/user');

router.get('/', userController.getUser);
router.post('/progress', userController.saveProgress);
router.post('/bonus', userController.saveBonus);
router.post('/deposit', userController.processDeposit);

module.exports = router;