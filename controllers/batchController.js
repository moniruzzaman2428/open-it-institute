const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Get all batches
exports.getAllBatches = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).select('assignedBatches');
    if (!teacher) return next(new AppError('Teacher profile not found.', 404));
    filter._id = { $in: teacher.assignedBatches || [] };
  }

  if (req.query.course) filter.course = req.query.course;
  if (req.query.teacher && req.user.role === 'admin') filter.teacher = req.query.teacher;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const search = String(req.query.search).trim();
    filter.$or = ['name', 'room', 'time'].map((field) => ({
      [field]: { $regex: search, $options: 'i' },
    }));
  }

  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 500);
  const sort = req.query.sort ? String(req.query.sort).split(',').join(' ') : '-createdAt';

  const [batches, total] = await Promise.all([
    Batch.find(filter)
      .populate('course', 'title slug fee duration')
      .populate('teacher', 'name email phone')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Batch.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    results: batches.length,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    data: { batches }
  });
});

// Get single batch
exports.getBatch = catchAsync(async (req, res, next) => {
  const batch = await Batch.findById(req.params.id)
    .populate('course', 'title slug fee duration')
    .populate('teacher', 'name email phone designation');

  if (!batch) {
    return next(new AppError('Batch not found.', 404));
  }

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).select('assignedBatches');
    const allowed = (teacher?.assignedBatches || []).map(String);
    if (!teacher || !allowed.includes(String(batch._id))) {
      return next(new AppError('You are not assigned to this batch.', 403));
    }
  }

  res.status(200).json({
    success: true,
    data: { batch }
  });
});

// Create batch
exports.createBatch = catchAsync(async (req, res, next) => {
  const { name, course, teacher, startDate, endDate, days, time, room, maximumStudents, status } = req.body;

  if (!name || !course || !teacher || !startDate || !endDate || !days || !time || !maximumStudents) {
    return next(new AppError('Please provide all required fields.', 400));
  }

  // Validate course exists
  const courseDoc = await Course.findById(course);
  if (!courseDoc) {
    return next(new AppError('Course not found.', 404));
  }

  // Validate teacher exists
  const teacherDoc = await Teacher.findById(teacher);
  if (!teacherDoc) {
    return next(new AppError('Teacher not found.', 404));
  }

  const batch = await Batch.create({
    name,
    course,
    teacher,
    startDate,
    endDate,
    days: Array.isArray(days) ? days : [days],
    time,
    room: room || '',
    maximumStudents,
    status: status || 'upcoming'
  });

  // Add batch to teacher's assignedBatches
  await Teacher.findByIdAndUpdate(teacher, {
    $addToSet: { assignedBatches: batch._id, assignedCourses: course }
  });

  await batch.populate('course', 'title slug');
  await batch.populate('teacher', 'name');

  res.status(201).json({
    success: true,
    message: 'Batch created successfully.',
    data: { batch }
  });
});

// Update batch
exports.updateBatch = catchAsync(async (req, res, next) => {
  const batch = await Batch.findById(req.params.id);

  if (!batch) {
    return next(new AppError('Batch not found.', 404));
  }

  const oldTeacher = batch.teacher ? String(batch.teacher) : null;
  const oldCourse = batch.course ? String(batch.course) : null;
  const allowedFields = ['name', 'course', 'teacher', 'startDate', 'endDate', 'days', 'time', 'room', 'maximumStudents', 'status'];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      batch[field] = req.body[field];
    }
  });

  if (req.body.course) {
    const courseDoc = await Course.findById(req.body.course);
    if (!courseDoc) return next(new AppError('Course not found.', 404));
  }
  if (req.body.teacher) {
    const teacherDoc = await Teacher.findById(req.body.teacher);
    if (!teacherDoc) return next(new AppError('Teacher not found.', 404));
  }

  await batch.save();

  const newTeacher = batch.teacher ? String(batch.teacher) : null;
  const newCourse = batch.course ? String(batch.course) : null;

  if (oldTeacher && oldTeacher !== newTeacher) {
    await Teacher.findByIdAndUpdate(oldTeacher, { $pull: { assignedBatches: batch._id } });
  }
  if (newTeacher) {
    await Teacher.findByIdAndUpdate(newTeacher, {
      $addToSet: { assignedBatches: batch._id, assignedCourses: batch.course }
    });
  }

  if (oldTeacher === newTeacher && oldCourse !== newCourse && newTeacher) {
    await Teacher.findByIdAndUpdate(newTeacher, { $addToSet: { assignedCourses: batch.course } });
  }
  await batch.populate('course', 'title slug');
  await batch.populate('teacher', 'name');

  res.status(200).json({
    success: true,
    message: 'Batch updated successfully.',
    data: { batch }
  });
});

// Delete batch
exports.deleteBatch = catchAsync(async (req, res, next) => {
  const batch = await Batch.findByIdAndDelete(req.params.id);

  if (!batch) {
    return next(new AppError('Batch not found.', 404));
  }

  // Remove from teacher's assignedBatches
  if (batch.teacher) {
    await Teacher.findByIdAndUpdate(batch.teacher, {
      $pull: { assignedBatches: batch._id }
    });
  }

  res.status(200).json({
    success: true,
    message: 'Batch deleted successfully.'
  });
});
