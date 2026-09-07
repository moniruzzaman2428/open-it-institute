const express = require('express');
const teacherController = require('../controllers/teacherController');
const { protect, restrictTo } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(restrictTo('admin'));

router
  .route('/')
  .get(teacherController.getAllTeachers)
  .post(upload.single('photo'), teacherController.createTeacher);

router
  .route('/:id')
  .get(teacherController.getTeacher)
  .patch(upload.single('photo'), teacherController.updateTeacher)
  .delete(teacherController.deleteTeacher);

module.exports = router;
