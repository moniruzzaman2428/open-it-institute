const Notice = require('../models/Notice');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');

exports.getAllNotices = catchAsync(async (req, res, next) => {
  const filter = {};
  // Public only sees published
  if (!req.user || req.user.role !== 'admin') {
    filter.status = 'published';
  }
  if (req.query.category) filter.category = req.query.category;

  const features = new APIFeatures(
    Notice.find(filter).populate('createdBy', 'name').sort('-publishDate'),
    req.query
  )
    .filter()
    .search(['title', 'description'])
    .paginate();

  const notices = await features.query;
  const total = await Notice.countDocuments(filter);

  res.status(200).json({
    success: true,
    results: notices.length,
    total,
    data: { notices }
  });
});

exports.createNotice = catchAsync(async (req, res, next) => {
  const { title, description, category, status, publishDate } = req.body;
  if (!title || !description) {
    return next(new AppError('Title and description are required.', 400));
  }

  const notice = await Notice.create({
    title,
    description,
    category: category || 'general',
    status: status || 'published',
    publishDate: publishDate || new Date(),
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Notice created successfully.',
    data: { notice }
  });
});

exports.updateNotice = catchAsync(async (req, res, next) => {
  const notice = await Notice.findById(req.params.id);
  if (!notice) return next(new AppError('Notice not found.', 404));

  ['title', 'description', 'category', 'status', 'publishDate'].forEach((f) => {
    if (req.body[f] !== undefined) notice[f] = req.body[f];
  });
  await notice.save();

  res.status(200).json({
    success: true,
    message: 'Notice updated successfully.',
    data: { notice }
  });
});

exports.deleteNotice = catchAsync(async (req, res, next) => {
  const notice = await Notice.findByIdAndDelete(req.params.id);
  if (!notice) return next(new AppError('Notice not found.', 404));

  res.status(200).json({
    success: true,
    message: 'Notice deleted successfully.'
  });
});
