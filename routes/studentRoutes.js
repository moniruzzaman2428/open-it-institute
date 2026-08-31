const express = require('express');
const studentController = require('../controllers/studentController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(restrictTo('admin', 'teacher'), studentController.getAllStudents)
  .post(restrictTo('admin'), studentController.createStudent);

router
  .route('/:id')
  .get(restrictTo('admin', 'teacher', 'student'), studentController.getStudent)
  .patch(restrictTo('admin'), studentController.updateStudent)
  .delete(restrictTo('admin'), studentController.deleteStudent);

module.exports = router;
