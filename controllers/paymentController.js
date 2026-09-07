const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Course = require('../models/Course');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');
const { generateReceiptNumber } = require('../utils/generateId');

// ======================
// Get all payments
// ======================
exports.getAllPayments = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (!student) return next(new AppError('Student profile not found.', 404));
    filter.student = student._id;
  }

  if (req.query.student) filter.student = req.query.student;
  if (req.query.course) filter.course = req.query.course;
  if (req.query.status) filter.status = req.query.status;

  const features = new APIFeatures(
    Payment.find(filter)
      .populate('student', 'name studentId phone')
      .populate('course', 'title fee discount')
      .populate('receivedBy', 'name'),
    req.query
  )
    .filter()
    .search([])
    .sort()
    .paginate();

  const payments = await features.query;
  const total = await Payment.countDocuments(filter);

  res.status(200).json({
    success: true,
    results: payments.length,
    total,
    data: { payments }
  });
});

// ======================
// Get single payment / receipt
// ======================
exports.getPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate('student', 'name studentId phone email address')
    .populate('course', 'title fee discount duration')
    .populate('receivedBy', 'name');

  if (!payment) {
    return next(new AppError('Payment not found.', 404));
  }

  // Student can only view own payments
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (!student || payment.student._id.toString() !== student._id.toString()) {
      return next(new AppError('Access denied.', 403));
    }
  }

  res.status(200).json({
    success: true,
    data: { payment }
  });
});

// ======================
// Get student payment summary
// ======================
exports.getStudentPaymentSummary = catchAsync(async (req, res, next) => {
  let studentId = req.params.studentId;

  // If student role, use their own ID
  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (!student) return next(new AppError('Student profile not found.', 404));
    studentId = student._id;
  }

  const student = await Student.findById(studentId).populate('course', 'title fee discount');
  if (!student) return next(new AppError('Student not found.', 404));

  const course = student.course;
  const totalFee = course
    ? (course.discount > 0
        ? Math.round(course.fee - (course.fee * course.discount) / 100)
        : course.fee)
    : 0;

  const payments = await Payment.find({
    student: studentId,
    status: { $in: ['paid', 'partial'] }
  }).sort('-paymentDate');

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const dueAmount = Math.max(totalFee - paidAmount, 0);

  res.status(200).json({
    success: true,
    data: {
      student: {
        id: student._id,
        name: student.name,
        studentId: student.studentId
      },
      course: course ? { title: course.title, fee: course.fee, discount: course.discount } : null,
      totalFee,
      paidAmount,
      dueAmount,
      payments
    }
  });
});

// ======================
// Create payment
// ======================
exports.createPayment = catchAsync(async (req, res, next) => {
  const { student, course, amount, paymentMethod, transactionId, paymentDate, remarks } = req.body;

  if (!student || !course || !amount || !paymentMethod) {
    return next(new AppError('Student, course, amount and payment method are required.', 400));
  }

  // Verify student
  const studentDoc = await Student.findById(student).populate('course', 'fee discount');
  if (!studentDoc) return next(new AppError('Student not found.', 404));

  // Calculate fee summary
  const courseDoc = await Course.findById(course);
  if (!courseDoc) return next(new AppError('Course not found.', 404));
  if (!studentDoc.course || String(studentDoc.course._id || studentDoc.course) !== String(courseDoc._id)) {
    return next(new AppError('This student is not enrolled in the selected course.', 400));
  }

  const totalFee = courseDoc.discount > 0
    ? Math.round(courseDoc.fee - (courseDoc.fee * courseDoc.discount) / 100)
    : courseDoc.fee;

  // Get previously paid amount
  const previousPayments = await Payment.find({
    student,
    course,
    status: { $in: ['paid', 'partial'] }
  });
  const previouslyPaid = previousPayments.reduce((sum, p) => sum + p.amount, 0);
  const newPaidTotal = previouslyPaid + Number(amount);
  const dueAmount = Math.max(totalFee - newPaidTotal, 0);

  // Determine status
  let status = 'paid';
  if (dueAmount > 0 && newPaidTotal > 0) status = 'partial';
  if (Number(amount) <= 0) status = 'due';

  // Generate unique receipt number
  let receiptNumber;
  let isUnique = false;
  while (!isUnique) {
    receiptNumber = generateReceiptNumber();
    const exists = await Payment.findOne({ receiptNumber });
    if (!exists) isUnique = true;
  }

  const payment = await Payment.create({
    student,
    course,
    amount: Number(amount),
    paymentMethod,
    transactionId: transactionId || '',
    receiptNumber,
    paymentDate: paymentDate || new Date(),
    status,
    receivedBy: req.user.id,
    remarks: remarks || '',
    totalFee,
    paidAmount: newPaidTotal,
    dueAmount
  });

  await payment.populate('student', 'name studentId phone');
  await payment.populate('course', 'title');
  await payment.populate('receivedBy', 'name');

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully.',
    data: {
      payment,
      summary: {
        totalFee,
        paidAmount: newPaidTotal,
        dueAmount
      }
    }
  });
});

// ======================
// Recalculate payment snapshots for a student/course ledger
// ======================
const recalculatePaymentLedger = async (studentId, courseId) => {
  const course = await Course.findById(courseId);
  if (!course) return;

  const totalFee = course.discount > 0
    ? Math.round(course.fee - (course.fee * course.discount) / 100)
    : course.fee;

  const payments = await Payment.find({ student: studentId, course: courseId })
    .sort('paymentDate createdAt');

  let cumulative = 0;
  for (const payment of payments) {
    if (payment.status !== 'cancelled') cumulative += Number(payment.amount) || 0;
    payment.totalFee = totalFee;
    payment.paidAmount = cumulative;
    payment.dueAmount = Math.max(totalFee - cumulative, 0);
    if (payment.status !== 'cancelled') {
      payment.status = payment.dueAmount > 0 ? 'partial' : 'paid';
    }
    await payment.save();
  }
};

exports.updatePayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return next(new AppError('Payment not found.', 404));

  const oldStudent = payment.student;
  const oldCourse = payment.course;
  const allowedFields = ['amount', 'paymentMethod', 'transactionId', 'paymentDate', 'remarks', 'status'];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) payment[field] = req.body[field];
  });

  if (payment.amount !== undefined && Number(payment.amount) <= 0) {
    return next(new AppError('Payment amount must be greater than 0.', 400));
  }

  await payment.save();
  await recalculatePaymentLedger(oldStudent, oldCourse);

  const updated = await Payment.findById(payment._id)
    .populate('student', 'name studentId phone')
    .populate('course', 'title fee discount')
    .populate('receivedBy', 'name');

  res.status(200).json({
    success: true,
    message: 'Payment updated successfully.',
    data: { payment: updated },
  });
});

exports.deletePayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) return next(new AppError('Payment not found.', 404));

  const { student, course } = payment;
  await Payment.findByIdAndDelete(payment._id);
  await recalculatePaymentLedger(student, course);

  res.status(200).json({ success: true, message: 'Payment deleted successfully.' });
});
