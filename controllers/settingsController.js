const WebsiteSettings = require('../models/WebsiteSettings');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getSettings = catchAsync(async (req, res, next) => {
  res.status(501).json({ success: false, message: 'Get Settings - Coming soon' });
});

exports.updateSettings = catchAsync(async (req, res, next) => {
  res.status(501).json({ success: false, message: 'Update Settings - Coming soon' });
});
