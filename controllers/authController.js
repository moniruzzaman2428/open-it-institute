const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const createSendToken = (user, statusCode, res, message = 'Success') => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  };

  res.cookie('token', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    message,
    token,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        status: user.status
      }
    }
  });
};

// ======================
// REGISTER
// ======================
exports.register = catchAsync(async (req, res, next) => {
  const { name, email, phone, password, role } = req.body;

  // Only allow student self-registration (admin/teacher created by admin)
  if (role && role !== 'student') {
    return next(new AppError('You can only register as a student. Contact admin for other roles.', 403));
  }

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email: email?.toLowerCase() }, { phone }]
  });

  if (existingUser) {
    return next(new AppError('User already exists with this email or phone number.', 400));
  }

  const user = await User.create({
    name,
    email: email?.toLowerCase(),
    phone,
    password,
    role: 'student'
  });

  createSendToken(user, 201, res, 'Registration successful');
});

// ======================
// LOGIN (Email / Phone / Student ID)
// ======================
exports.login = catchAsync(async (req, res, next) => {
  const { login, password } = req.body; // login can be email, phone or studentId

  if (!login || !password) {
    return next(new AppError('Please provide login credentials and password.', 400));
  }

  let user = null;

  // Try to find by email
  if (login.includes('@')) {
    user = await User.findOne({ email: login.toLowerCase() }).select('+password');
  }

  // Try to find by phone
  if (!user && /^[0-9+\-\s]+$/.test(login)) {
    user = await User.findOne({ phone: login.replace(/\s+/g, '') }).select('+password');
  }

  // Try to find by Student ID
  if (!user) {
    const student = await Student.findOne({ studentId: login.toUpperCase() }).populate({
      path: 'userId',
      select: '+password'
    });

    if (student && student.userId) {
      user = student.userId;
    }
  }

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect login credentials or password.', 401));
  }

  if (user.status !== 'active') {
    return next(new AppError('Your account is inactive or suspended. Please contact admin.', 403));
  }

  createSendToken(user, 200, res, 'Login successful');
});

// ======================
// LOGOUT
// ======================
exports.logout = catchAsync(async (req, res, next) => {
  res.cookie('token', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// ======================
// GET CURRENT USER
// ======================
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    return next(new AppError('User not found.', 404));
  }

  // Attach extra profile data based on role
  let profile = null;

  if (user.role === 'student') {
    profile = await Student.findOne({ userId: user._id })
      .populate('course', 'title slug duration fee')
      .populate('batch', 'name time days room');
  }

  if (user.role === 'teacher') {
    const Teacher = require('../models/Teacher');
    profile = await Teacher.findOne({ userId: user._id })
      .populate('assignedCourses', 'title slug')
      .populate('assignedBatches', 'name time');
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        status: user.status,
        createdAt: user.createdAt
      },
      profile
    }
  });
});

// ======================
// FORGOT PASSWORD
// ======================
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError('Please provide your email address.', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Don't reveal if user exists
    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.'
    });
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  await user.save({ validateBeforeSave: false });

  // In production you would send email here
  // For now we return the token (remove in production)
  const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  res.status(200).json({
    success: true,
    message: 'Password reset token generated successfully.',
    // Only for development – remove in production
    resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
    resetURL: process.env.NODE_ENV === 'development' ? resetURL : undefined
  });
});

// ======================
// RESET PASSWORD
// ======================
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return next(new AppError('Token and new password are required.', 400));
  }

  if (password.length < 6) {
    return next(new AppError('Password must be at least 6 characters.', 400));
  }

  // Hash the token to compare
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Token is invalid or has expired.', 400));
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  createSendToken(user, 200, res, 'Password reset successful');
});

// ======================
// CHANGE PASSWORD (logged in)
// ======================
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError('Please provide current password and new password.', 400));
  }

  if (newPassword.length < 6) {
    return next(new AppError('New password must be at least 6 characters.', 400));
  }

  const user = await User.findById(req.user.id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Your current password is incorrect.', 401));
  }

  user.password = newPassword;
  await user.save();

  createSendToken(user, 200, res, 'Password changed successfully');
});
