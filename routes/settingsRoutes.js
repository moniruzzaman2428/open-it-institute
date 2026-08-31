const express = require('express');
const settingsController = require('../controllers/settingsController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public (for website)
router.get('/', optionalAuth, settingsController.getSettings);

// Admin only
router.use(protect);
router.use(restrictTo('admin'));

router.patch('/', settingsController.updateSettings);

module.exports = router;
