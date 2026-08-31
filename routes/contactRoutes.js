const express = require('express');
const contactController = require('../controllers/contactController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Public
router.post('/', contactController.createContactMessage);

// Admin
router.use(protect);
router.use(restrictTo('admin'));

router.get('/', contactController.getAllMessages);
router.patch('/:id', contactController.updateMessageStatus);

module.exports = router;
