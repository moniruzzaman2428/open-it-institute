const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Batch = require('../models/Batch');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const uploadToCloudinary = require('../utils/cloudinaryUpload');

const populateTeacher = (query) =>
  query
    .populate('userId', 'name email phone profileImage status role')
    .populate('assignedCourses', 'title slug duration fee status')
    .populate('assignedBatches', 'name time days room status course');

const parseArray = (value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

exports.getAllTeachers = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const regex = { $regex: req.query.search, $options: 'i' };
    filter.$or = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { designation: regex },
    ];
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const sort = req.query.sort ? req.query.sort.split(',').join(' ') : '-createdAt';

  const [teachers, total] = await Promise.all([
    populateTeacher(
      Teacher.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
    ),
    Teacher.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    results: teachers.length,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    data: { teachers },
  });
});

exports.getTeacher = catchAsync(async (req, res, next) => {
  const teacher = await populateTeacher(Teacher.findById(req.params.id));
  if (!teacher) return next(new AppError('Teacher not found.', 404));

  res.status(200).json({ success: true, data: { teacher } });
});

exports.createTeacher = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, designation, experience, bio, status } = req.body;
  if (!name || !email || !phone || !designation) {
    return next(new AppError('Name, email, phone and designation are required.', 400));
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { phone }] });
  if (existing) {
    return next(new AppError('A user already exists with this email or phone.', 409));
  }

  let photo = '';
  if (req.file) {
    const uploaded = await uploadToCloudinary(req.file.buffer, 'open-it-institute/teachers');
    photo = uploaded.secure_url;
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    phone: String(phone).trim(),
    password: password || 'Teacher@123',
    role: 'teacher',
    status: status === 'inactive' ? 'inactive' : 'active',
    profileImage: photo,
  });

  try {
    const teacher = await Teacher.create({
      userId: user._id,
      name: name.trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      designation: designation.trim(),
      skills: parseArray(req.body.skills),
      experience: experience || '',
      bio: bio || '',
      assignedCourses: parseArray(req.body.assignedCourses),
      status: status || 'active',
      photo,
    });

    const populated = await populateTeacher(Teacher.findById(teacher._id));
    return res.status(201).json({
      success: true,
      message: 'Teacher created successfully.',
      data: { teacher: populated },
    });
  } catch (error) {
    await User.findByIdAndDelete(user._id).catch(() => {});
    throw error;
  }
});

exports.updateTeacher = catchAsync(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) return next(new AppError('Teacher not found.', 404));

  const user = await User.findById(teacher.userId);
  if (!user) return next(new AppError('Linked teacher account not found.', 404));

  if (req.body.email !== undefined) {
    const email = String(req.body.email).toLowerCase().trim();
    const duplicate = await User.findOne({ email, _id: { $ne: user._id } });
    if (duplicate) return next(new AppError('Email is already in use.', 409));
    teacher.email = email;
    user.email = email;
  }

  if (req.body.phone !== undefined) {
    const phone = String(req.body.phone).trim();
    const duplicate = await User.findOne({ phone, _id: { $ne: user._id } });
    if (duplicate) return next(new AppError('Phone number is already in use.', 409));
    teacher.phone = phone;
    user.phone = phone;
  }

  ['name', 'designation', 'experience', 'bio', 'status'].forEach((field) => {
    if (req.body[field] !== undefined) teacher[field] = req.body[field];
  });

  if (req.body.skills !== undefined) teacher.skills = parseArray(req.body.skills);
  if (req.body.assignedCourses !== undefined) {
    teacher.assignedCourses = parseArray(req.body.assignedCourses);
  }

  if (req.file) {
    const uploaded = await uploadToCloudinary(req.file.buffer, 'open-it-institute/teachers');
    teacher.photo = uploaded.secure_url;
    user.profileImage = uploaded.secure_url;
  }

  if (req.body.name !== undefined) user.name = req.body.name;
  if (req.body.status !== undefined) user.status = req.body.status === 'active' ? 'active' : 'inactive';
  if (req.body.password) user.password = req.body.password;

  await teacher.save();
  await user.save();

  const populated = await populateTeacher(Teacher.findById(teacher._id));
  res.status(200).json({
    success: true,
    message: 'Teacher updated successfully.',
    data: { teacher: populated },
  });
});

exports.deleteTeacher = catchAsync(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);
  if (!teacher) return next(new AppError('Teacher not found.', 404));

  const assignedBatchCount = await Batch.countDocuments({ teacher: teacher._id });
  if (assignedBatchCount > 0) {
    return next(
      new AppError(
        `This teacher is assigned to ${assignedBatchCount} batch(es). Reassign or delete those batches first.`,
        409
      )
    );
  }

  await Teacher.findByIdAndDelete(teacher._id);
  if (teacher.userId) await User.findByIdAndDelete(teacher.userId);

  res.status(200).json({ success: true, message: 'Teacher deleted successfully.' });
});
