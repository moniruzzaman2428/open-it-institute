const Exam = require('../models/Exam');
const Batch = require('../models/Batch');
const Teacher = require('../models/Teacher');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');

// Get all exams
exports.getAllExams = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher) return next(new AppError('Teacher profile not found.', 404));
    filter.batch = { $in: teacher.assignedBatches };
  } else if (req.user.role === 'student') {
    const Student = require('../models/Student');
    const student = await Student.findOne({ userId: req.user.id });
    if (!student) return next(new AppError('Student profile not found.', 404));
    filter.batch = student.batch;
    filter.course = student.course;
  }

  const features = new APIFeatures(
    Exam.find(filter)
      .populate('course', 'title')
      .populate('batch', 'name time')
      .populate('createdBy', 'name'),
    req.query
  )
    .filter()
    .search(['title'])
    .sort()
    .paginate();

  const exams = await features.query;
  const total = await Exam.countDocuments(filter);

  res.status(200).json({
    success: true,
    results: exams.length,
    total,
    data: { exams }
  });
});

// Create exam
exports.createExam = catchAsync(async (req, res, next) => {
  const { title, course, batch, examDate, totalMarks, passingMarks, type } = req.body;

  if (!title || !course || !batch || !examDate || !totalMarks || passingMarks === undefined) {
    return next(new AppError('Please provide all required fields.', 400));
  }

  // Teacher can only create for assigned batches
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === batch)) {
      return next(new AppError('You are not assigned to this batch.', 403));
    }
  }

  const batchDoc = await Batch.findById(batch);
  if (!batchDoc) return next(new AppError('Batch not found.', 404));

  const exam = await Exam.create({
    title,
    course,
    batch,
    examDate,
    totalMarks,
    passingMarks,
    type: type || 'other',
    status: new Date(examDate) > new Date() ? 'upcoming' : 'completed',
    createdBy: req.user.id
  });

  await exam.populate('course', 'title');
  await exam.populate('batch', 'name');

  res.status(201).json({
    success: true,
    message: 'Exam created successfully.',
    data: { exam }
  });
});

// Update exam
exports.updateExam = catchAsync(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return next(new AppError('Exam not found.', 404));

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === exam.batch.toString())) {
      return next(new AppError('You cannot modify this exam.', 403));
    }
  }

  const allowed = ['title', 'examDate', 'totalMarks', 'passingMarks', 'type', 'status'];
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) exam[f] = req.body[f];
  });

  await exam.save();
  await exam.populate('course', 'title');
  await exam.populate('batch', 'name');

  res.status(200).json({
    success: true,
    message: 'Exam updated successfully.',
    data: { exam }
  });
});

// Delete exam
exports.deleteExam = catchAsync(async (req, res, next) => {
  const exam = await Exam.findById(req.params.id);
  if (!exam) return next(new AppError('Exam not found.', 404));

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === exam.batch.toString())) {
      return next(new AppError('You cannot delete this exam.', 403));
    }
  }

  // Also delete related results
  const Result = require('../models/Result');
  await Result.deleteMany({ exam: exam._id });
  await exam.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Exam and related results deleted successfully.'
  });
});
