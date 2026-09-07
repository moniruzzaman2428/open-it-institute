const express = require('express');
const studentController = require('../controllers/studentController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(restrictTo('admin', 'teacher'), studentController.getAllStudents)
  .post(restrictTo('admin'), studentController.createStudent);

// MUST be before /:id — otherwise "me" is parsed as an ObjectId
router.get(
  '/me',
  restrictTo('admin', 'teacher', 'student'),
  studentController.getMyProfile
);

router.patch(
  '/me',
  restrictTo('student'),
  studentController.updateMyProfile
);

router
  .route('/:id')
  .get(restrictTo('admin', 'teacher', 'student'), studentController.getStudent)
  .patch(restrictTo('admin', 'student'), studentController.updateStudent)
  .delete(restrictTo('admin'), studentController.deleteStudent);

module.exports = router;