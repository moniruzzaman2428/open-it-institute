const Gallery = require('../models/Gallery');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const cloudinary = require('../config/cloudinary');
const uploadToCloudinary = require('../utils/cloudinaryUpload');


// ===============================
// GET ALL GALLERY
// ===============================

exports.getAllGallery = catchAsync(async (req, res, next) => {

  const filter = {};

  if (req.query.category) {
    filter.category = req.query.category;
  }

  const gallery = await Gallery.find(filter)
    .populate('createdBy', 'name')
    .sort('-createdAt');


  res.status(200).json({
    success: true,
    results: gallery.length,
    data: {
      gallery
    }
  });

});


// ===============================
// CREATE GALLERY ITEM
// ===============================

exports.createGalleryItem = catchAsync(async (req, res, next) => {

  const { title, category } = req.body;


  // Validation
  if (!title) {
    return next(
      new AppError('Title is required.', 400)
    );
  }


  if (!req.file) {
    return next(
      new AppError('Image file is required.', 400)
    );
  }


  // Upload image to Cloudinary
  const cloudinaryResult = await uploadToCloudinary(
    req.file.buffer,
    'open-it-institute/gallery'
  );


  // Save to MongoDB
  const item = await Gallery.create({

    title,

    image: cloudinaryResult.secure_url,

    publicId: cloudinaryResult.public_id,

    category: category || 'classroom',

    createdBy: req.user.id

  });


  res.status(201).json({

    success: true,

    message: 'Gallery image uploaded successfully.',

    data: {
      item
    }

  });

});


// ===============================
// DELETE GALLERY ITEM
// ===============================

exports.deleteGalleryItem = catchAsync(async (req, res, next) => {

  const item = await Gallery.findById(
    req.params.id
  );


  if (!item) {
    return next(
      new AppError('Gallery item not found.', 404)
    );
  }


  // Delete image from Cloudinary
  if (item.publicId) {

    await cloudinary.uploader.destroy(
      item.publicId
    );

  }


  // Delete from MongoDB
  await Gallery.findByIdAndDelete(
    req.params.id
  );


  res.status(200).json({

    success: true,

    message: 'Gallery item deleted successfully.'

  });

});
// ===============================
// UPDATE GALLERY ITEM
// ===============================
exports.updateGalleryItem = catchAsync(async (req, res, next) => {
  const item = await Gallery.findById(req.params.id);
  if (!item) return next(new AppError('Gallery item not found.', 404));

  if (req.body.title !== undefined) item.title = req.body.title;
  if (req.body.category !== undefined) item.category = req.body.category;

  if (req.file) {
    const uploaded = await uploadToCloudinary(
      req.file.buffer,
      'open-it-institute/gallery'
    );

    const oldPublicId = item.publicId;
    item.image = uploaded.secure_url;
    item.publicId = uploaded.public_id;

    if (oldPublicId) {
      await cloudinary.uploader.destroy(oldPublicId).catch(() => {});
    }
  }

  await item.save();
  await item.populate('createdBy', 'name');

  res.status(200).json({
    success: true,
    message: 'Gallery item updated successfully.',
    data: { item },
  });
});
