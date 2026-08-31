const express = require('express');
const courseController = require('../controllers/courseController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public
router.get('/', optionalAuth, courseController.getAllCourses);
router.get('/:slug', optionalAuth, courseController.getCourse);

// Admin only
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', courseController.createCourse);
router.patch('/:id', courseController.updateCourse);
router.delete('/:id', courseController.deleteCourse);

module.exports = router;
