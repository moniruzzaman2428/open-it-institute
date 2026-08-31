const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Student payment summary
router.get(
  '/summary/:studentId?',
  restrictTo('admin', 'student'),
  paymentController.getStudentPaymentSummary
);

router
  .route('/')
  .get(restrictTo('admin', 'student'), paymentController.getAllPayments)
  .post(restrictTo('admin'), paymentController.createPayment);

router.get('/:id', restrictTo('admin', 'student'), paymentController.getPayment);

module.exports = router;
