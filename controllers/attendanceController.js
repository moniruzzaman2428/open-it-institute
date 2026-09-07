const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const Teacher = require('../models/Teacher');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// ======================
// Mark Attendance (bulk)
// ======================
exports.markAttendance = catchAsync(async (req, res, next) => {
  const { course, batch, date, records } = req.body;
  // records: [{ student: id, status: 'present'|'absent'|'late' }]

  if (!course || !batch || !date || !records || !Array.isArray(records) || records.length === 0) {
    return next(new AppError('Course, batch, date and attendance records are required.', 400));
  }

  // Verify batch exists
  const batchDoc = await Batch.findById(batch);
  if (!batchDoc) {
    return next(new AppError('Batch not found.', 404));
  }

  // If teacher, verify they are assigned to this batch
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === batch)) {
      return next(new AppError('You are not assigned to this batch.', 403));
    }
  }

  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);

  const results = [];
  const errors = [];

  for (const record of records) {
    try {
      // Upsert: update if exists, create if not
      const attendance = await Attendance.findOneAndUpdate(
        {
          student: record.student,
          batch,
          date: {
            $gte: attendanceDate,
            $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        {
          student: record.student,
          course,
          batch,
          date: attendanceDate,
          status: record.status,
          markedBy: req.user.id,
          remarks: record.remarks || ''
        },
        { upsert: true, new: true, runValidators: true }
      );
      results.push(attendance);
    } catch (err) {
      errors.push({ student: record.student, error: err.message });
    }
  }

  res.status(200).json({
    success: true,
    message: `Attendance marked for ${results.length} students.`,
    data: {
      marked: results.length,
      errors: errors.length > 0 ? errors : undefined
    }
  });
});

// ======================
// Get Attendance
// ======================
exports.getAttendance = catchAsync(async (req, res, next) => {
  const { batch, course, student, date, startDate, endDate } = req.query;

  const filter = {};

  // Role-based filtering
  if (req.user.role === 'student') {
    const studentDoc = await Student.findOne({ userId: req.user.id });
    if (!studentDoc) {
      return next(new AppError('Student profile not found.', 404));
    }
    filter.student = studentDoc._id;
  } else if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher) {
      return next(new AppError('Teacher profile not found.', 404));
    }
    // Teacher can only see their assigned batches
    if (batch) {
      if (!teacher.assignedBatches.some((b) => b.toString() === batch)) {
        return next(new AppError('You are not assigned to this batch.', 403));
      }
      filter.batch = batch;
    } else {
      filter.batch = { $in: teacher.assignedBatches };
    }
  } else {
    // Admin can filter freely
    if (batch) filter.batch = batch;
    if (student) filter.student = student;
  }

  if (course) filter.course = course;

  // Date filters
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    filter.date = {
      $gte: d,
      $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000)
    };
  } else if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  const attendance = await Attendance.find(filter)
    .populate('student', 'name studentId')
    .populate('course', 'title')
    .populate('batch', 'name time')
    .populate('markedBy', 'name')
    .sort('-date');

  // Calculate stats if student-specific
  let stats = null;
  if (filter.student || req.user.role === 'student') {
    const total = attendance.length;
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const late = attendance.filter((a) => a.status === 'late').length;
    const percentage = total > 0 ? Math.round(((present + late * 0.5) / total) * 100) : 0;

    stats = { total, present, absent, late, percentage };
  }

  res.status(200).json({
    success: true,
    results: attendance.length,
    stats,
    data: { attendance }
  });
});

// ======================
// Get students for a batch (for marking attendance)
// ======================
exports.getBatchStudents = catchAsync(async (req, res, next) => {
  const { batchId } = req.params;

  const batch = await Batch.findById(batchId);
  if (!batch) {
    return next(new AppError('Batch not found.', 404));
  }

  // Teacher permission check
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === batchId)) {
      return next(new AppError('You are not assigned to this batch.', 403));
    }
  }

  const students = await Student.find({ batch: batchId, status: 'active' })
    .select('name studentId phone photo')
    .sort('name');

  // Check if attendance already marked for a date
  const { date } = req.query;
  let existingAttendance = {};

  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const records = await Attendance.find({
      batch: batchId,
      date: {
        $gte: d,
        $lt: new Date(d.getTime() + 24 * 60 * 60 * 1000)
      }
    });
    records.forEach((r) => {
      existingAttendance[r.student.toString()] = r.status;
    });
  }

  res.status(200).json({
    success: true,
    results: students.length,
    data: {
      students,
      existingAttendance,
      batch: {
        id: batch._id,
        name: batch.name,
        course: batch.course
      }
    }
  });
});

// ======================
// Update single attendance
// ======================
exports.updateAttendance = catchAsync(async (req, res, next) => {
  const { status, remarks } = req.body;

  const attendance = await Attendance.findById(req.params.id);
  if (!attendance) {
    return next(new AppError('Attendance record not found.', 404));
  }

  // Teacher can only update their batch attendance
  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    if (!teacher || !teacher.assignedBatches.some((b) => b.toString() === attendance.batch.toString())) {
      return next(new AppError('You cannot modify this attendance record.', 403));
    }
  }

  if (status) attendance.status = status;
  if (remarks !== undefined) attendance.remarks = remarks;
  attendance.markedBy = req.user.id;
  await attendance.save();

  res.status(200).json({
    success: true,
    message: 'Attendance updated successfully.',
    data: { attendance }
  });
});


// ======================
// Delete attendance (Admin)
// ======================
exports.deleteAttendance = catchAsync(async (req, res, next) => {
  const attendance = await Attendance.findByIdAndDelete(req.params.id);
  if (!attendance) return next(new AppError('Attendance record not found.', 404));

  res.status(200).json({
    success: true,
    message: 'Attendance record deleted successfully.',
  });
});
