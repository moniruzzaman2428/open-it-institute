const Teacher = require('../models/Teacher');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getAllTeachers = catchAsync(async (req, res, next) => {
  res.status(501).json({ success: false, message: 'Get All Teachers - Coming soon' });
});

exports.getTeacher = catchAsync(async (req, res, next) => {
  res.status(501).json({ success: false, message: 'Get Teacher - Coming soon' });
});

exports.createTeacher = catchAsync(async (req, res, next) => {
  res.status(501).json({ success: false, message: 'Create Teacher - Coming soon' });
});

exports.updateTeacher = catchAsync(async (req, res, next) => {
  res.status(501).json({ success: false, message: 'Update Teacher - Coming soon' });
});

exports.deleteTeacher = catchAsync(async (req, res, next) => {
  res.status(501).json({ success: false, message: 'Delete Teacher - Coming soon' });
});
