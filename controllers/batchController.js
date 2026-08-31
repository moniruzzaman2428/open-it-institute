const Batch = require('../models/Batch');
const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');

// Get all batches
exports.getAllBatches = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Batch.find()
      .populate('course', 'title slug fee duration')
      .populate('teacher', 'name email phone'),
    req.query
  )
    .filter()
    .search(['name', 'room', 'time'])
    .sort()
    .paginate();

  const batches = await features.query;
  const total = await Batch.countDocuments();

  res.status(200).json({
    success: true,
    results: batches.length,
    total,
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

  const allowedFields = ['name', 'course', 'teacher', 'startDate', 'endDate', 'days', 'time', 'room', 'maximumStudents', 'status'];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      batch[field] = req.body[field];
    }
  });

  await batch.save();
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
