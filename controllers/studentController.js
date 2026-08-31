const Student = require('../models/Student');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');
const { generateStudentId } = require('../utils/generateId');

exports.getAllStudents = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.user.role === 'teacher') {
    // Teachers see students in their batches - handled via query if needed
  }

  const features = new APIFeatures(
    Student.find(filter)
      .populate('course', 'title slug fee discount')
      .populate('batch', 'name time')
      .populate('userId', 'email status'),
    req.query
  )
    .filter()
    .search(['name', 'studentId', 'phone', 'email'])
    .sort()
    .paginate();

  const students = await features.query;
  const total = await Student.countDocuments(filter);

  res.status(200).json({
    success: true,
    results: students.length,
    total,
    data: { students }
  });
});

exports.getStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findById(req.params.id)
    .populate('course', 'title slug fee discount duration')
    .populate('batch', 'name time days room')
    .populate('userId', 'email status profileImage');

  if (!student) {
    return next(new AppError('Student not found.', 404));
  }

  // Student can only view own profile
  if (req.user.role === 'student') {
    const own = await Student.findOne({ userId: req.user.id });
    if (!own || own._id.toString() !== student._id.toString()) {
      return next(new AppError('Access denied.', 403));
    }
  }

  res.status(200).json({
    success: true,
    data: { student }
  });
});

exports.createStudent = catchAsync(async (req, res, next) => {
  // Admin creates student manually
  const { name, email, phone, password, fatherName, motherName, dateOfBirth, gender, address, education, course, batch, photo } = req.body;

  if (!name || !email || !phone || !course || !batch) {
    return next(new AppError('Name, email, phone, course and batch are required.', 400));
  }

  let user = await User.findOne({ $or: [{ email }, { phone }] });
  if (!user) {
    user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: password || phone,
      role: 'student',
      status: 'active',
      profileImage: photo || ''
    });
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
    name,
    fatherName: fatherName || '',
    motherName: motherName || '',
    dateOfBirth: dateOfBirth || new Date(),
    gender: gender || 'male',
    phone,
    email: email.toLowerCase(),
    address: address || '',
    education: education || '',
    course,
    batch,
    photo: photo || '',
    status: 'active'
  });

  // Increment batch count
  const Batch = require('../models/Batch');
  await Batch.findByIdAndUpdate(batch, { $inc: { currentStudents: 1 } });

  res.status(201).json({
    success: true,
    message: 'Student created successfully.',
    data: { student }
  });
});

exports.updateStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findById(req.params.id);
  if (!student) return next(new AppError('Student not found.', 404));

  const allowed = ['name', 'fatherName', 'motherName', 'dateOfBirth', 'gender', 'phone', 'email', 'address', 'education', 'course', 'batch', 'status', 'photo'];
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) student[f] = req.body[f];
  });

  await student.save();

  res.status(200).json({
    success: true,
    message: 'Student updated successfully.',
    data: { student }
  });
});

exports.deleteStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) return next(new AppError('Student not found.', 404));

  res.status(200).json({
    success: true,
    message: 'Student deleted successfully.'
  });
});
