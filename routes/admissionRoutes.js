const express = require('express');
const admissionController = require('../controllers/admissionController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Public - online admission form
router.post('/', admissionController.createAdmission);

// Admin only
router.use(protect);
router.use(restrictTo('admin'));
router.get(
  '/batches/:courseId',
  admissionController.getAdmissionBatches
);
router.get('/', admissionController.getAllAdmissions);
router.get('/:id', admissionController.getAdmission);
router.patch('/:id', admissionController.updateAdmission);
router.delete('/:id', admissionController.deleteAdmission);

module.exports = router;
