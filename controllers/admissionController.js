const Admission = require('../models/Admission');
const User = require('../models/User');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');
const { generateApplicationId, generateStudentId } = require('../utils/generateId');

// ======================
// HELPER: Validate Batch
// ======================
const getValidBatchForCourse = async (batchId, courseId) => {
  // যদি batchId না থাকে, তাহলে available batch খুঁজুন
  if (!batchId) {
    const availableBatch = await Batch.findOne({
      course: courseId,
      status: { $in: ['upcoming', 'ongoing'] },
      $expr: { $lt: ['$currentStudents', '$maximumStudents'] }
    }).populate('teacher', 'name');

    if (!availableBatch) {
      throw new AppError(
        'No available batch found for this course. Please create a batch with a teacher assigned first.',
        400
      );
    }

    return availableBatch;
  }

  // Validate provided batch ID
  if (!batchId.match(/^[0-9a-fA-F]{24}$/)) {
    throw new AppError('Invalid batch ID format.', 400);
  }

  const batch = await Batch.findById(batchId).populate('teacher', 'name');
  
  if (!batch) {
    throw new AppError('Selected batch not found.', 404);
  }

  // ✅ Check if batch belongs to the course
  if (String(batch.course) !== String(courseId)) {
    throw new AppError('Selected batch does not belong to the selected course.', 400);
  }

  // ✅ Check if batch has a teacher assigned
  if (!batch.teacher) {
    throw new AppError('Selected batch does not have a teacher assigned. Please assign a teacher first.', 400);
  }

  // ✅ Check batch status
  if (['completed', 'cancelled'].includes(batch.status)) {
    throw new AppError('Selected batch is not open for admission.', 400);
  }

  // ✅ Check if batch is full
  if (batch.currentStudents >= batch.maximumStudents) {
    throw new AppError('Selected batch is already full. Maximum capacity: ' + batch.maximumStudents, 400);
  }

  return batch;
};

// ======================
// PUBLIC: Submit Admission
// ======================
exports.createAdmission = catchAsync(async (req, res, next) => {
  const {
    studentName,
    fatherName,
    motherName,
    dateOfBirth,
    gender,
    phone,
    email,
    address,
    education,
    course,
    batch,
    photo
  } = req.body;

  // Validate required fields
  if (!studentName || !fatherName || !motherName || !dateOfBirth || !gender || !phone || !email || !address || !education || !course) {
    return next(new AppError('Please fill all required fields.', 400));
  }

  // Find course by ID or slug
  let courseDoc = null;
  if (course.match(/^[0-9a-fA-F]{24}$/)) {
    courseDoc = await Course.findById(course);
  } else {
    courseDoc = await Course.findOne({ slug: course });
  }

  if (!courseDoc) {
    return next(new AppError('Selected course not found.', 404));
  }

  // Validate batch if provided
  if (batch) {
    await getValidBatchForCourse(batch, courseDoc._id);
  }

  // Check for existing pending application with same phone/email
  const existing = await Admission.findOne({
    $or: [{ phone }, { email: email.toLowerCase() }],
    status: 'pending'
  });

  if (existing) {
    return next(new AppError('You already have a pending application. Please wait for review.', 400));
  }

  // Generate unique Application ID
  let applicationId;
  let isUnique = false;
  while (!isUnique) {
    applicationId = generateApplicationId();
    const exists = await Admission.findOne({ applicationId });
    if (!exists) isUnique = true;
  }

  const admission = await Admission.create({
    applicationId,
    studentName,
    fatherName,
    motherName,
    dateOfBirth,
    gender,
    phone,
    email: email.toLowerCase(),
    address,
    education,
    course: courseDoc._id,
    batch: batch || undefined,
    photo: photo || '',
    status: 'pending'
  });

  // Populate course for response
  await admission.populate('course', 'title slug');

  res.status(201).json({
    success: true,
    message: 'Admission application submitted successfully!',
    data: {
      applicationId: admission.applicationId,
      studentName: admission.studentName,
      course: admission.course?.title,
      status: admission.status,
      appliedAt: admission.appliedAt
    }
  });
});

// ======================
// ADMIN: Get All Admissions
// ======================
exports.getAllAdmissions = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Admission.find()
      .populate('course', 'title slug')
      .populate('batch', 'name time')
      .populate('reviewedBy', 'name'),
    req.query
  )
    .filter()
    .search(['studentName', 'phone', 'email', 'applicationId'])
    .sort()
    .paginate();

  const admissions = await features.query;
  const total = await Admission.countDocuments();

  // Count by status
  const pending = await Admission.countDocuments({ status: 'pending' });
  const approved = await Admission.countDocuments({ status: 'approved' });
  const rejected = await Admission.countDocuments({ status: 'rejected' });

  res.status(200).json({
    success: true,
    results: admissions.length,
    total,
    stats: { pending, approved, rejected },
    data: { admissions }
  });
});

// ======================
// ADMIN: Get Single Admission
// ======================
exports.getAdmission = catchAsync(async (req, res, next) => {
  const admission = await Admission.findById(req.params.id)
    .populate('course', 'title slug fee duration')
    .populate('batch', 'name time days teacher')
    .populate('reviewedBy', 'name email');

  if (!admission) {
    return next(new AppError('Admission application not found.', 404));
  }

  res.status(200).json({
    success: true,
    data: { admission }
  });
});

// ======================
// ADMIN: Update / Approve / Reject
// ======================
exports.updateAdmission = catchAsync(async (req, res, next) => {
  const { status, remarks, batch } = req.body;

  const admission = await Admission.findById(req.params.id).populate('course');

  if (!admission) {
    return next(new AppError('Admission application not found.', 404));
  }

  // If already processed
  if (admission.status !== 'pending' && status) {
    return next(new AppError(`This application is already ${admission.status}.`, 400));
  }

  // ========== APPROVE ==========
  if (status === 'approved') {
    // Resolve and validate the batch
    let batchDoc = null;
    let batchId = batch || admission.batch;

    try {
      // Try to get valid batch
      batchDoc = await getValidBatchForCourse(batchId, admission.course._id);
      batchId = batchDoc._id;
    } catch (error) {
      // If no batch found or invalid, try to find any available batch
      console.log('Batch validation failed:', error.message);
      
      // Find any available batch for this course
      batchDoc = await Batch.findOne({
        course: admission.course._id,
        status: { $in: ['upcoming', 'ongoing'] },
        $expr: { $lt: ['$currentStudents', '$maximumStudents'] }
      }).populate('teacher', 'name');

      if (!batchDoc) {
        return next(new AppError(
          'No available batch found for this course. Please create a batch with a teacher assigned first.',
          400
        ));
      }

      // ✅ Check if the found batch has a teacher
      if (!batchDoc.teacher) {
        return next(new AppError(
          'The available batch does not have a teacher assigned. Please assign a teacher to the batch first.',
          400
        ));
      }

      batchId = batchDoc._id;
    }

    // Final check - ensure batch has teacher
    const finalBatch = await Batch.findById(batchId).populate('teacher', 'name');
    if (!finalBatch) {
      return next(new AppError('Batch not found.', 404));
    }

    if (!finalBatch.teacher) {
      return next(new AppError(
        'Batch does not have a teacher assigned. Please assign a teacher to the batch before approving.',
        400
      ));
    }

    // Check if user already exists
    let user = await User.findOne({
      $or: [{ email: admission.email }, { phone: admission.phone }]
    });

    if (!user) {
      // Create User account (default password = phone number)
      user = await User.create({
        name: admission.studentName,
        email: admission.email,
        phone: admission.phone,
        password: admission.phone, // default password
        role: 'student',
        status: 'active',
        profileImage: admission.photo || ''
      });
    } else if (user.role !== 'student') {
      return next(new AppError('A user with this email/phone already exists with a different role.', 400));
    }

    // Generate unique Student ID
    let studentId;
    let isUnique = false;
    while (!isUnique) {
      studentId = generateStudentId();
      const exists = await Student.findOne({ studentId });
      if (!exists) isUnique = true;
    }

    // Check if student profile already exists
    let student = await Student.findOne({ userId: user._id });

    if (!student) {
      student = await Student.create({
        userId: user._id,
        studentId,
        name: admission.studentName,
        fatherName: admission.fatherName,
        motherName: admission.motherName,
        dateOfBirth: admission.dateOfBirth,
        gender: admission.gender,
        phone: admission.phone,
        email: admission.email,
        address: admission.address,
        education: admission.education,
        course: admission.course._id,
        batch: batchId,
        photo: admission.photo || '',
        status: 'active',
        admissionDate: new Date()
      });

      // Increment batch student count
      await Batch.findByIdAndUpdate(batchId, { $inc: { currentStudents: 1 } });
    }

    admission.status = 'approved';
    admission.reviewedBy = req.user.id;
    admission.reviewedAt = new Date();
    admission.remarks = remarks || 'Application approved';
    admission.batch = batchId;
    await admission.save();

    return res.status(200).json({
      success: true,
      message: 'Admission approved successfully. Student account created.',
      data: {
        admission,
        student: {
          studentId: student.studentId,
          name: student.name,
          defaultPassword: 'Phone number (ask student to change)'
        }
      }
    });
  }

  // ========== REJECT ==========
  if (status === 'rejected') {
    admission.status = 'rejected';
    admission.reviewedBy = req.user.id;
    admission.reviewedAt = new Date();
    admission.remarks = remarks || 'Application rejected';
    await admission.save();

    return res.status(200).json({
      success: true,
      message: 'Admission application rejected.',
      data: { admission }
    });
  }

  // ========== GENERAL UPDATE ==========
  if (remarks !== undefined) admission.remarks = remarks;
  if (batch) {
    if (admission.status !== 'pending') {
      return next(new AppError('Change the student batch from the Students module after an admission is processed.', 400));
    }
    await getValidBatchForCourse(batch, admission.course._id);
    admission.batch = batch;
  }
  await admission.save();

  res.status(200).json({
    success: true,
    message: 'Admission updated successfully.',
    data: { admission }
  });
});

// ======================
// ADMIN: Delete Admission
// ======================
exports.deleteAdmission = catchAsync(async (req, res, next) => {
  const admission = await Admission.findByIdAndDelete(req.params.id);

  if (!admission) {
    return next(new AppError('Admission application not found.', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Admission application deleted successfully.'
  });
});