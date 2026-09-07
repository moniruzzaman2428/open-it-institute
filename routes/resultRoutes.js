const express = require('express');
const resultController = require('../controllers/resultController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/student/:studentId', restrictTo('admin', 'teacher', 'student'), resultController.getResultsByStudentId);

router
  .route('/')
  .get(restrictTo('admin', 'teacher', 'student'), resultController.getResults)
  .post(restrictTo('admin', 'teacher'), resultController.createResult);

router.patch('/:id', restrictTo('admin', 'teacher'), resultController.updateResult);
router.delete('/:id', restrictTo('admin', 'teacher'), resultController.deleteResult);

router.post(
  '/publish/:examId',
  restrictTo('admin', 'teacher'),
  resultController.publishExamResults
);

module.exports = router;
