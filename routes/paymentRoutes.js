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

router
  .route('/:id')
  .get(restrictTo('admin', 'student'), paymentController.getPayment)
  .patch(restrictTo('admin'), paymentController.updatePayment)
  .delete(restrictTo('admin'), paymentController.deletePayment);

module.exports = router;
