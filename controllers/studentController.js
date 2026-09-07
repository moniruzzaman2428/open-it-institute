const Student = require('../models/Student');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Teacher = require('../models/Teacher');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { generateStudentId } = require('../utils/generateId');

const populateStudent = (query) => {
  return query
    .populate(
      'course',
      'title slug name fee discount duration description shortDescription curriculum modules topics instructor teacher'
    )
    .populate({
      path: 'batch',
      select:
        'name time days room currentStudents totalStudents startDate status teacher',
      populate: { path: 'teacher', select: 'name email' },
    })
    .populate('userId', 'name email phone status profileImage role');
};

const extractStudent = (req) => {
  return Student.findOne({ userId: req.user.id });
};

const applyStudentFields = (student, body) => {
  const fields = [
    'name',
    'fatherName',
    'motherName',
    'dateOfBirth',
    'gender',
    'phone',
    'address',
    'education',
    'photo',
  ];

  fields.forEach((field) => {
    if (body[field] !== undefined) {
      student[field] = body[field];
    }
  });
};

const applyAdminFields = (student, body) => {
  const fields = [
    'name',
    'fatherName',
    'motherName',
    'dateOfBirth',
    'gender',
    'phone',
    'email',
    'address',
    'education',
    'course',
    'batch',
    'status',
    'photo',
  ];

  fields.forEach((field) => {
    if (body[field] !== undefined) {
      student[field] = body[field];
    }
  });

  if (body.email !== undefined) {
    student.email = String(body.email).toLowerCase().trim();
  }
};

const syncLinkedUser = async (student, body, isAdmin) => {
  if (!student.userId) return;

  const user = await User.findById(student.userId);
  if (!user) return;

  if (body.name !== undefined) user.name = body.name;
  if (body.phone !== undefined) user.phone = body.phone;
  if (body.photo !== undefined) user.profileImage = body.photo;

  if (isAdmin && body.email !== undefined) {
    user.email = String(body.email).toLowerCase().trim();
  }

  await user.save({ validateBeforeSave: false });
};

const adjustBatchCount = async (fromBatch, toBatch) => {
  const fromId = fromBatch ? String(fromBatch) : null;
  const toId = toBatch ? String(toBatch) : null;

  if (fromId === toId) return;

  if (fromId) {
    const previousBatch = await Batch.findById(fromId);
    if (previousBatch) {
      previousBatch.currentStudents = Math.max(Number(previousBatch.currentStudents || 0) - 1, 0);
      await previousBatch.save({ validateBeforeSave: false });
    }
  }

  if (toId) {
    const nextBatch = await Batch.findById(toId);
    if (nextBatch) {
      nextBatch.currentStudents = Number(nextBatch.currentStudents || 0) + 1;
      await nextBatch.save({ validateBeforeSave: false });
    }
  }
};

const validateEnrollment = async (courseId, batchId, currentBatchId = null) => {
  const batch = await Batch.findById(batchId);
  if (!batch) throw new AppError('Selected batch not found.', 404);

  if (String(batch.course) !== String(courseId)) {
    throw new AppError('Selected batch does not belong to the selected course.', 400);
  }

  const isMoving = !currentBatchId || String(currentBatchId) !== String(batchId);
  if (
    isMoving &&
    Number(batch.maximumStudents || 0) > 0 &&
    Number(batch.currentStudents || 0) >= Number(batch.maximumStudents)
  ) {
    throw new AppError('Selected batch is already full.', 400);
  }

  return batch;
};

exports.getAllStudents = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).select('assignedBatches');
    if (!teacher) return next(new AppError('Teacher profile not found.', 404));
    filter.batch = { $in: teacher.assignedBatches || [] };
  }

  if (req.query.status) filter.status = req.query.status;
  if (req.query.course) filter.course = req.query.course;
  if (req.query.batch && req.user.role !== 'teacher') filter.batch = req.query.batch;
  if (req.query.batch && req.user.role === 'teacher') {
    const allowed = (filter.batch?.$in || []).map(String);
    if (!allowed.includes(String(req.query.batch))) {
      return res.status(200).json({ success: true, results: 0, total: 0, data: { students: [] } });
    }
    filter.batch = req.query.batch;
  }

  if (req.query.search) {
    const search = String(req.query.search).trim();
    filter.$or = ['name', 'studentId', 'phone', 'email'].map((field) => ({
      [field]: { $regex: search, $options: 'i' },
    }));
  }

  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 500);
  const sort = req.query.sort ? String(req.query.sort).split(',').join(' ') : '-createdAt';

  const [students, total] = await Promise.all([
    populateStudent(Student.find(filter))
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Student.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    results: students.length,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    data: { students },
  });
});

exports.getMyProfile = catchAsync(async (req, res, next) => {
  const student = await populateStudent(extractStudent(req));

  if (!student) {
    return next(new AppError('Student profile not found.', 404));
  }

  res.status(200).json({
    success: true,
    data: { student },
  });
});

exports.getStudent = catchAsync(async (req, res, next) => {
  const student = await populateStudent(Student.findById(req.params.id));

  if (!student) {
    return next(new AppError('Student not found.', 404));
  }

  if (req.user.role === 'student') {
    const ownStudent = await Student.findOne({ userId: req.user.id });

    if (!ownStudent || ownStudent._id.toString() !== student._id.toString()) {
      return next(new AppError('Access denied.', 403));
    }
  }

  if (req.user.role === 'teacher') {
    const teacher = await Teacher.findOne({ userId: req.user.id }).select('assignedBatches');
    const allowedBatches = (teacher?.assignedBatches || []).map(String);
    const studentBatch = student.batch?._id || student.batch;
    if (!teacher || !allowedBatches.includes(String(studentBatch))) {
      return next(new AppError('You can only view students from your assigned batches.', 403));
    }
  }

  res.status(200).json({
    success: true,
    data: { student },
  });
});

exports.createStudent = catchAsync(async (req, res, next) => {
  const {
    name,
    email,
    phone,
    password,
    fatherName,
    motherName,
    dateOfBirth,
    gender,
    address,
    education,
    course,
    batch,
    photo,
  } = req.body;

  if (!name || !email || !phone || !course || !batch) {
    return next(
      new AppError('Name, email, phone, course and batch are required.', 400)
    );
  }

  if (!fatherName || !motherName || !dateOfBirth || !gender || !address || !education) {
    return next(
      new AppError(
        "Father's name, mother's name, date of birth, gender, address and education are required.",
        400
      )
    );
  }

  const normalizedEmail = email.toLowerCase().trim();
  await validateEnrollment(course, batch);

  let user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phone }],
  });

  if (!user) {
    user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone,
      password: password || phone,
      role: 'student',
      status: 'active',
      profileImage: photo || '',
    });
  } else {
    const existingStudent = await Student.findOne({ userId: user._id });

    if (existingStudent) {
      return next(
        new AppError('A student profile already exists for this user.', 409)
      );
    }

    if (user.role !== 'student') {
      return next(
        new AppError('This email or phone belongs to another user account.', 409)
      );
    }
  }

  let studentId;
  let isUnique = false;

  while (!isUnique) {
    studentId = generateStudentId();
    const exists = await Student.findOne({ studentId });
    if (!exists) isUnique = true;
  }

  const student = await Student.create({
    userId: user._id,
    studentId,
    name: name.trim(),
    fatherName: fatherName.trim(),
    motherName: motherName.trim(),
    dateOfBirth,
    gender,
    phone,
    email: normalizedEmail,
    address: address.trim(),
    education: education.trim(),
    course,
    batch,
    photo: photo || '',
    status: 'active',
  });

  await adjustBatchCount(null, batch);

  const populatedStudent = await populateStudent(Student.findById(student._id));

  res.status(201).json({
    success: true,
    message: 'Student created successfully.',
    data: { student: populatedStudent },
  });
});

exports.updateStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return next(new AppError('Student not found.', 404));
  }

  if (req.user.role === 'student') {
    const ownStudent = await Student.findOne({ userId: req.user.id });

    if (!ownStudent || ownStudent._id.toString() !== student._id.toString()) {
      return next(new AppError('You can only update your own profile.', 403));
    }

    applyStudentFields(student, req.body);
  }

  const oldBatch = student.batch;

  if (req.user.role === 'admin') {
    const nextCourse = req.body.course !== undefined ? req.body.course : student.course;
    const nextBatch = req.body.batch !== undefined ? req.body.batch : student.batch;
    await validateEnrollment(nextCourse, nextBatch, oldBatch);
    applyAdminFields(student, req.body);
  }

  if (req.user.role === 'teacher') {
    return next(new AppError('Teachers cannot update student profiles.', 403));
  }

  await student.save();

  if (req.user.role === 'admin' && req.body.batch !== undefined) {
    await adjustBatchCount(oldBatch, student.batch);
  }

  await syncLinkedUser(student, req.body, req.user.role === 'admin');

  const updatedStudent = await populateStudent(Student.findById(student._id));

  res.status(200).json({
    success: true,
    message: 'Student profile updated successfully.',
    data: { student: updatedStudent },
  });
});

exports.updateMyProfile = catchAsync(async (req, res, next) => {
  const student = await Student.findOne({ userId: req.user.id });

  if (!student) {
    return next(new AppError('Student profile not found.', 404));
  }

  applyStudentFields(student, req.body);
  await student.save();
  await syncLinkedUser(student, req.body, false);

  const updatedStudent = await populateStudent(Student.findById(student._id));

  res.status(200).json({
    success: true,
    message: 'Student profile updated successfully.',
    data: { student: updatedStudent },
  });
});

exports.deleteStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findById(req.params.id);

  if (!student) {
    return next(new AppError('Student not found.', 404));
  }

  const oldBatch = student.batch;

  await Student.findByIdAndDelete(req.params.id);

  if (oldBatch) {
    await adjustBatchCount(oldBatch, null);
  }

  if (student.userId) {
    const otherStudent = await Student.findOne({ userId: student.userId });

    if (!otherStudent) {
      await User.findByIdAndDelete(student.userId);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Student deleted successfully.',
  });
});