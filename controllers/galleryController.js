const Gallery = require('../models/Gallery');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.getAllGallery = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;

  const gallery = await Gallery.find(filter)
    .populate('createdBy', 'name')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    results: gallery.length,
    data: { gallery }
  });
});

exports.createGalleryItem = catchAsync(async (req, res, next) => {
  const { title, image, category } = req.body;
  if (!title || !image) {
    return next(new AppError('Title and image URL are required.', 400));
  }

  const item = await Gallery.create({
    title,
    image,
    category: category || 'classroom',
    createdBy: req.user.id
  });

  res.status(201).json({
    success: true,
    message: 'Gallery item added successfully.',
    data: { item }
  });
});

exports.deleteGalleryItem = catchAsync(async (req, res, next) => {
  const item = await Gallery.findByIdAndDelete(req.params.id);
  if (!item) return next(new AppError('Gallery item not found.', 404));

  res.status(200).json({
    success: true,
    message: 'Gallery item deleted successfully.'
  });
});
