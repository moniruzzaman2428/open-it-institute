const Result = require('../models/Result');
const Exam = require('../models/Exam');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Get results
exports.getResults = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (!student) return next(new AppError('Student profile not found.', 404));
    filter.student = student._id;
    filter.isPublished = true; // Students only see published results
  } else if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher) return next(new AppError('Teacher profile not found.', 404));
    // Filter by teacher's batches via exams
    const exams = await Exam.find({ batch: { $in: teacher.assignedBatches } }).select('_id');
    filter.exam = { $in: exams.map((e) => e._id) };
  }

  // Additional filters from query
  if (req.query.exam) filter.exam = req.query.exam;
  if (req.query.student) filter.student = req.query.student;
  if (req.query.course) filter.course = req.query.course;

  const results = await Result.find(filter)
    .populate('student', 'name studentId')
    .populate('exam', 'title examDate totalMarks')
    .populate('course', 'title')
    .populate('publishedBy', 'name')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    results: results.length,
    data: { results }
  });
});

// Create / Enter result (single or bulk)
exports.createResult = catchAsync(async (req, res, next) => {
  // Support both single and bulk
  const items = req.body.results ? req.body.results : [req.body];

  if (!items.length) {
    return next(new AppError('No result data provided.', 400));
  }

  const created = [];
  const errors = [];

  for (const item of items) {
    try {
      const { student, exam, course, marks } = item;

      if (!student || !exam || !course || marks === undefined) {
        errors.push({ student, error: 'Missing required fields' });
        continue;
      }

      // Verify exam
      const examDoc = await Exam.findById(exam);
      if (!examDoc) {
        errors.push({ student, error: 'Exam not found' });
        continue;
      }

      // Teacher permission
      if (req.user.role === 'teacher') {
        const teacher = await Teacher.findOne({ userId: req.user.id });
        if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === examDoc.batch.toString())) {
          errors.push({ student, error: 'Not authorized for this exam' });
          continue;
        }
      }

      // Validate marks
      if (marks < 0 || marks > examDoc.totalMarks) {
        errors.push({ student, error: `Marks must be 0-${examDoc.totalMarks}` });
        continue;
      }

      // Upsert result (grade auto-calculated by model pre-validate)
      const result = await Result.findOneAndUpdate(
        { student, exam },
        {
          student,
          exam,
          course: course || examDoc.course,
          marks,
          isPublished: item.isPublished || false,
          publishedAt: item.isPublished ? new Date() : undefined,
          publishedBy: item.isPublished ? req.user.id : undefined
        },
        { upsert: true, new: true, runValidators: true }
      );

      created.push(result);
    } catch (err) {
      errors.push({ student: item.student, error: err.message });
    }
  }

  res.status(201).json({
    success: true,
    message: `${created.length} result(s) saved.`,
    data: {
      results: created,
      errors: errors.length > 0 ? errors : undefined
    }
  });
});

// Update result (marks, publish)
exports.updateResult = catchAsync(async (req, res, next) => {
  const result = await Result.findById(req.params.id).populate('exam');
  if (!result) return next(new AppError('Result not found.', 404));

  // Teacher permission
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    const exam = await Exam.findById(result.exam);
    if (!teacher || !exam || !teacher.assignedBatches.some((b) => b.toString() === exam.batch.toString())) {
      return next(new AppError('You cannot modify this result.', 403));
    }
  }

  if (req.body.marks !== undefined) {
    result.marks = req.body.marks;
  }

  if (req.body.isPublished !== undefined) {
    result.isPublished = req.body.isPublished;
    if (req.body.isPublished) {
      result.publishedAt = new Date();
      result.publishedBy = req.user.id;
    }
  }

  await result.save(); // triggers grade recalculation

  res.status(200).json({
    success: true,
    message: 'Result updated successfully.',
    data: { result }
  });
});

// Publish all results for an exam
exports.publishExamResults = catchAsync(async (req, res, next) => {
  const { examId } = req.params;

  const exam = await Exam.findById(examId);
  if (!exam) return next(new AppError('Exam not found.', 404));

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === exam.batch.toString())) {
      return next(new AppError('Not authorized.', 403));
    }
  }

  const result = await Result.updateMany(
    { exam: examId },
    {
      isPublished: true,
      publishedAt: new Date(),
      publishedBy: req.user.id
    }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} result(s) published.`,
    data: { modifiedCount: result.modifiedCount }
  });
});
