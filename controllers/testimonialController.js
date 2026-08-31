const Testimonial = require('../models/Testimonial');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.getAllTestimonials = catchAsync(async (req, res, next) => {
  const filter = {};
  if (!req.user || req.user.role !== 'admin') {
    filter.status = 'active';
  }

  const testimonials = await Testimonial.find(filter).sort('-createdAt');

  res.status(200).json({
    success: true,
    results: testimonials.length,
    data: { testimonials }
  });
});

exports.createTestimonial = catchAsync(async (req, res, next) => {
  const { studentName, course, photo, review, rating, status } = req.body;
  if (!studentName || !course || !review || !rating) {
    return next(new AppError('Student name, course, review and rating are required.', 400));
  }

  const testimonial = await Testimonial.create({
    studentName,
    course,
    photo: photo || '',
    review,
    rating: Number(rating),
    status: status || 'active'
  });

  res.status(201).json({
    success: true,
    message: 'Testimonial created successfully.',
    data: { testimonial }
  });
});

exports.updateTestimonial = catchAsync(async (req, res, next) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) return next(new AppError('Testimonial not found.', 404));

  ['studentName', 'course', 'photo', 'review', 'rating', 'status'].forEach((f) => {
    if (req.body[f] !== undefined) testimonial[f] = req.body[f];
  });
  await testimonial.save();

  res.status(200).json({
    success: true,
    message: 'Testimonial updated successfully.',
    data: { testimonial }
  });
});

exports.deleteTestimonial = catchAsync(async (req, res, next) => {
  const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
  if (!testimonial) return next(new AppError('Testimonial not found.', 404));

  res.status(200).json({
    success: true,
    message: 'Testimonial deleted successfully.'
  });
});
