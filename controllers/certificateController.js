const Certificate = require('../models/Certificate');
const Student = require('../models/Student');
const Course = require('../models/Course');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { generateCertificateId, generateVerificationCode } = require('../utils/generateId');

// ======================
// Get all certificates
// ======================
exports.getAllCertificates = catchAsync(async (req, res, next) => {
  const filter = {};

  if (req.user.role === 'student') {
    const student = await Student.findOne({ userId: req.user.id });
    if (!student) return next(new AppError('Student profile not found.', 404));
    filter.student = student._id;
  }

  if (req.query.student) filter.student = req.query.student;
  if (req.query.course) filter.course = req.query.course;
  if (req.query.status) filter.status = req.query.status;

  const certificates = await Certificate.find(filter)
    .populate('student', 'name studentId phone email')
    .populate('course', 'title duration')
    .populate('issuedBy', 'name')
    .sort('-issueDate');

  res.status(200).json({
    success: true,
    results: certificates.length,
    data: { certificates }
  });
});

// ======================
// Create / Issue certificate
// ======================
exports.createCertificate = catchAsync(async (req, res, next) => {
  const { student, course, completionDate, duration } = req.body;

  if (!student || !course || !completionDate) {
    return next(new AppError('Student, course and completion date are required.', 400));
  }

  // Verify student
  const studentDoc = await Student.findById(student);
  if (!studentDoc) return next(new AppError('Student not found.', 404));

  // Verify course
  const courseDoc = await Course.findById(course);
  if (!courseDoc) return next(new AppError('Course not found.', 404));

  // Check if certificate already exists for this student+course
  const existing = await Certificate.findOne({ student, course, status: 'valid' });
  if (existing) {
    return next(new AppError('A valid certificate already exists for this student and course.', 400));
  }

  // Generate unique IDs
  let certificateId;
  let isUnique = false;
  while (!isUnique) {
    certificateId = generateCertificateId();
    const exists = await Certificate.findOne({ certificateId });
    if (!exists) isUnique = true;
  }

  let verificationCode;
  isUnique = false;
  while (!isUnique) {
    verificationCode = generateVerificationCode();
    const exists = await Certificate.findOne({ verificationCode });
    if (!exists) isUnique = true;
  }

  const certificate = await Certificate.create({
    certificateId,
    verificationCode,
    student,
    course,
    completionDate,
    issueDate: new Date(),
    status: 'valid',
    issuedBy: req.user.id,
    duration: duration || courseDoc.duration || ''
  });

  // Optionally mark student as completed
  if (studentDoc.status === 'active') {
    studentDoc.status = 'completed';
    await studentDoc.save();
  }

  await certificate.populate('student', 'name studentId');
  await certificate.populate('course', 'title duration');
  await certificate.populate('issuedBy', 'name');

  res.status(201).json({
    success: true,
    message: 'Certificate issued successfully.',
    data: { certificate }
  });
});

// ======================
// PUBLIC: Verify certificate
// ======================
exports.verifyCertificate = catchAsync(async (req, res, next) => {
  const { certificateId } = req.params;

  if (!certificateId) {
    return next(new AppError('Certificate ID is required.', 400));
  }

  const certificate = await Certificate.findOne({
    $or: [
      { certificateId: certificateId.toUpperCase() },
      { verificationCode: certificateId.toUpperCase() }
    ]
  })
    .populate('student', 'name studentId')
    .populate('course', 'title duration')
    .populate('issuedBy', 'name');

  if (!certificate) {
    return res.status(200).json({
      success: true,
      valid: false,
      message: 'Certificate not found or invalid.',
      data: null
    });
  }

  if (certificate.status !== 'valid') {
    return res.status(200).json({
      success: true,
      valid: false,
      message: `Certificate is ${certificate.status}.`,
      data: {
        certificateId: certificate.certificateId,
        status: certificate.status
      }
    });
  }

  res.status(200).json({
    success: true,
    valid: true,
    message: 'Certificate is valid.',
    data: {
      certificateId: certificate.certificateId,
      verificationCode: certificate.verificationCode,
      studentName: certificate.student?.name,
      studentId: certificate.student?.studentId,
      course: certificate.course?.title,
      duration: certificate.duration || certificate.course?.duration,
      completionDate: certificate.completionDate,
      issueDate: certificate.issueDate,
      status: certificate.status,
      institute: 'OPEN IT INSTITUTE'
    }
  });
});

// ======================
// Revoke certificate (Admin)
// ======================
exports.revokeCertificate = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findById(req.params.id);
  if (!certificate) return next(new AppError('Certificate not found.', 404));

  certificate.status = 'revoked';
  await certificate.save();

  res.status(200).json({
    success: true,
    message: 'Certificate revoked successfully.',
    data: { certificate }
  });
});

exports.updateCertificate = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findById(req.params.id);
  if (!certificate) return next(new AppError('Certificate not found.', 404));

  ['completionDate', 'duration', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) certificate[field] = req.body[field];
  });

  await certificate.save();
  await certificate.populate('student', 'name studentId');
  await certificate.populate('course', 'title duration');
  await certificate.populate('issuedBy', 'name');

  res.status(200).json({
    success: true,
    message: 'Certificate updated successfully.',
    data: { certificate },
  });
});

exports.deleteCertificate = catchAsync(async (req, res, next) => {
  const certificate = await Certificate.findByIdAndDelete(req.params.id);
  if (!certificate) return next(new AppError('Certificate not found.', 404));

  res.status(200).json({ success: true, message: 'Certificate deleted successfully.' });
});
