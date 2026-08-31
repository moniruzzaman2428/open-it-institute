const express = require('express');
const examController = require('../controllers/examController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(restrictTo('admin', 'teacher', 'student'), examController.getAllExams)
  .post(restrictTo('admin', 'teacher'), examController.createExam);

router
  .route('/:id')
  .patch(restrictTo('admin', 'teacher'), examController.updateExam)
  .delete(restrictTo('admin', 'teacher'), examController.deleteExam);

module.exports = router;
