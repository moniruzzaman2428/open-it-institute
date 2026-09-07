const express = require('express');
const attendanceController = require('../controllers/attendanceController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Get students of a batch (for marking)
router.get(
  '/batch/:batchId/students',
  restrictTo('admin', 'teacher'),
  attendanceController.getBatchStudents
);

router
  .route('/')
  .get(restrictTo('admin', 'teacher', 'student'), attendanceController.getAttendance)
  .post(restrictTo('admin', 'teacher'), attendanceController.markAttendance);

router.patch(
  '/:id',
  restrictTo('admin', 'teacher'),
  attendanceController.updateAttendance
);

router.delete(
  '/:id',
  restrictTo('admin'),
  attendanceController.deleteAttendance
);

module.exports = router;
