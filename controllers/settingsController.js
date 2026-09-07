const WebsiteSettings = require('../models/WebsiteSettings');
const catchAsync = require('../utils/catchAsync');

exports.getSettings = catchAsync(async (req, res) => {
  const settings = await WebsiteSettings.getSettings();
  res.status(200).json({ success: true, data: { settings } });
});

exports.updateSettings = catchAsync(async (req, res) => {
  const settings = await WebsiteSettings.getSettings();
  const allowedFields = [
    'instituteName', 'logo', 'favicon', 'phone', 'email', 'address',
    'facebookUrl', 'youtubeUrl', 'googleMap', 'heroHeadline',
    'heroSubheadline', 'aboutText', 'mission', 'vision', 'footerText',
    'totalStudents', 'totalCourses', 'totalTeachers', 'successfulStudents',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) settings[field] = req.body[field];
  });

  await settings.save();
  res.status(200).json({
    success: true,
    message: 'Website settings updated successfully.',
    data: { settings },
  });
});
