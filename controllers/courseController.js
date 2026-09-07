const Course = require('../models/Course');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');
const { generateSlug } = require('../utils/generateId');

// Public + Admin: Get all courses
exports.getAllCourses = catchAsync(async (req, res, next) => {
  const filter = {};
  // Public users only see active courses
  if (!req.user || req.user.role !== 'admin') {
    filter.status = 'active';
  }

  const features = new APIFeatures(Course.find(filter), req.query)
    .filter()
    .search(['title', 'description'])
    .sort()
    .paginate();

  const courses = await features.query;
  const total = await Course.countDocuments(filter);

  res.status(200).json({
    success: true,
    results: courses.length,
    total,
    data: { courses }
  });
});

// Public + Admin: Get single course by slug or ID
exports.getCourse = catchAsync(async (req, res, next) => {
  const { slug } = req.params;

  let course;
  if (slug.match(/^[0-9a-fA-F]{24}$/)) {
    course = await Course.findById(slug);
  } else {
    course = await Course.findOne({ slug });
  }

  if (!course) {
    return next(new AppError('Course not found.', 404));
  }

  // Non-admins can only see active courses
  if (course.status !== 'active' && (!req.user || req.user.role !== 'admin')) {
    return next(new AppError('Course not found.', 404));
  }

  res.status(200).json({
    success: true,
    data: { course }
  });
});

// Admin: Create course
exports.createCourse = catchAsync(async (req, res, next) => {
  const { title, description, duration, classHours, fee, discount, instructor, curriculum, requirements, benefits, image, status } = req.body;

  if (!title || !description || !duration || fee === undefined) {
    return next(new AppError('Title, description, duration and fee are required.', 400));
  }

  let slug = generateSlug(title);

  // Ensure unique slug
  const existing = await Course.findOne({ slug });
  if (existing) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  const course = await Course.create({
    title,
    slug,
    description,
    duration,
    classHours: classHours || '',
    fee,
    discount: discount || 0,
    instructor: instructor || '',
    curriculum: curriculum || [],
    requirements: requirements || [],
    benefits: benefits || [],
    image: image || '',
    status: status || 'active'
  });

  res.status(201).json({
    success: true,
    message: 'Course created successfully.',
    data: { course }
  });
});

// Admin: Update course
exports.updateCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findById(req.params.id);

  if (!course) {
    return next(new AppError('Course not found.', 404));
  }

  const oldTitle = course.title;
  const allowedFields = ['title', 'description', 'duration', 'classHours', 'fee', 'discount', 'instructor', 'curriculum', 'requirements', 'benefits', 'image', 'status'];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      course[field] = req.body[field];
    }
  });

  // Regenerate slug if title changed
  if (req.body.title && req.body.title !== oldTitle) {
    let newSlug = generateSlug(req.body.title);
    const existing = await Course.findOne({ slug: newSlug, _id: { $ne: course._id } });
    if (existing) {
      newSlug = `${newSlug}-${Date.now().toString().slice(-4)}`;
    }
    course.slug = newSlug;
  }

  await course.save();

  res.status(200).json({
    success: true,
    message: 'Course updated successfully.',
    data: { course }
  });
});

// Admin: Delete course
exports.deleteCourse = catchAsync(async (req, res, next) => {
  const course = await Course.findByIdAndDelete(req.params.id);

  if (!course) {
    return next(new AppError('Course not found.', 404));
  }

  res.status(200).json({
    success: true,
    message: 'Course deleted successfully.'
  });
});
