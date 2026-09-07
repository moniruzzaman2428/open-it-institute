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
    const exams = await Exam.find({ batch: { $in: teacher.assignedBatches } }).select('_id');
    const allowedExamIds = exams.map((e) => String(e._id));

    if (req.query.exam) {
      if (!allowedExamIds.includes(String(req.query.exam))) {
        return next(new AppError('You are not authorized to view this exam results.', 403));
      }
      filter.exam = req.query.exam;
    } else {
      filter.exam = { $in: exams.map((e) => e._id) };
    }
  }

  // Additional filters from query
  if (req.query.exam && req.user.role !== 'teacher') filter.exam = req.query.exam;
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

      const studentDoc = await Student.findById(student).select('batch course');
      if (!studentDoc) {
        errors.push({ student, error: 'Student not found' });
        continue;
      }
      if (String(studentDoc.batch) !== String(examDoc.batch)) {
        errors.push({ student, error: 'Student does not belong to the exam batch' });
        continue;
      }
      if (String(studentDoc.course) !== String(examDoc.course)) {
        errors.push({ student, error: 'Student course does not match the exam course' });
        continue;
      }
      if (course && String(course) !== String(examDoc.course)) {
        errors.push({ student, error: 'Result course does not match the exam course' });
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

      // Use document save so grade/status pre-validation middleware always runs.
      let result = await Result.findOne({ student, exam });
      if (!result) {
        result = new Result({
          student,
          exam,
          course: course || examDoc.course,
          marks,
        });
      } else {
        result.course = course || examDoc.course;
        result.marks = marks;
      }

      if (item.isPublished !== undefined) {
        result.isPublished = Boolean(item.isPublished);
        result.publishedAt = item.isPublished ? new Date() : undefined;
        result.publishedBy = item.isPublished ? req.user.id : undefined;
      }

      await result.save();
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
    const marks = Number(req.body.marks);
    const totalMarks = Number(result.exam?.totalMarks);
    if (!Number.isFinite(marks) || marks < 0 || marks > totalMarks) {
      return next(new AppError(`Marks must be between 0 and ${totalMarks}.`, 400));
    }
    result.marks = marks;
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


exports.getResultsByStudentId = catchAsync(async (req, res, next) => {
  let studentId = req.params.studentId;

  if (req.user.role === 'student') {
    const own = await Student.findOne({ userId: req.user.id });
    if (!own) return next(new AppError('Student profile not found.', 404));
    if (own._id.toString() !== String(studentId) && own.studentId !== String(studentId).toUpperCase()) {
      return next(new AppError('Access denied.', 403));
    }
    studentId = own._id;
  } else if (!String(studentId).match(/^[a-f\d]{24}$/i)) {
    const student = await Student.findOne({ studentId: String(studentId).toUpperCase() });
    if (!student) return next(new AppError('Student not found.', 404));
    studentId = student._id;
  }

  if (req.user.role === 'teacher') {
    const [teacher, student] = await Promise.all([
      Teacher.findOne({ userId: req.user.id }).select('assignedBatches'),
      Student.findById(studentId).select('batch'),
    ]);
    const allowedBatches = (teacher?.assignedBatches || []).map(String);
    if (!teacher || !student || !allowedBatches.includes(String(student.batch))) {
      return next(new AppError('You can only view results for students in your assigned batches.', 403));
    }
  }

  const resultFilter = { student: studentId };
  if (req.user.role === 'student') resultFilter.isPublished = true;

  const results = await Result.find(resultFilter)
    .populate('student', 'name studentId')
    .populate('exam', 'title examDate totalMarks passingMarks type')
    .populate('course', 'title')
    .populate('publishedBy', 'name')
    .sort('-createdAt');

  res.status(200).json({ success: true, results: results.length, data: { results } });
});

exports.deleteResult = catchAsync(async (req, res, next) => {
  const result = await Result.findById(req.params.id);
  if (!result) return next(new AppError('Result not found.', 404));

  if (req.user.role === 'teacher') {
    const [teacher, exam] = await Promise.all([
      Teacher.findOne({ userId: req.user.id }).select('assignedBatches'),
      Exam.findById(result.exam).select('batch'),
    ]);
    const allowedBatches = (teacher?.assignedBatches || []).map(String);
    if (!teacher || !exam || !allowedBatches.includes(String(exam.batch))) {
      return next(new AppError('You cannot delete this result.', 403));
    }
  }

  await result.deleteOne();
  res.status(200).json({ success: true, message: 'Result deleted successfully.' });
});
