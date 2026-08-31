const express = require('express');
const testimonialController = require('../controllers/testimonialController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public
router.get('/', optionalAuth, testimonialController.getAllTestimonials);

// Admin
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', testimonialController.createTestimonial);
router.patch('/:id', testimonialController.updateTestimonial);
router.delete('/:id', testimonialController.deleteTestimonial);

module.exports = router;
