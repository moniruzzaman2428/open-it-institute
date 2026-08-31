const express = require('express');
const noticeController = require('../controllers/noticeController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public - published notices
router.get('/', optionalAuth, noticeController.getAllNotices);

// Admin
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', noticeController.createNotice);
router.patch('/:id', noticeController.updateNotice);
router.delete('/:id', noticeController.deleteNotice);

module.exports = router;
