const ContactMessage = require('../models/ContactMessage');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

exports.createContactMessage = catchAsync(async (req, res, next) => {
  const { name, phone, email, message } = req.body;
  if (!name || !phone || !email || !message) {
    return next(new AppError('All fields are required.', 400));
  }

  const contactMessage = await ContactMessage.create({
    name,
    phone,
    email: email.toLowerCase(),
    message,
    status: 'unread'
  });

  res.status(201).json({
    success: true,
    message: 'Your message has been sent successfully. We will contact you soon.',
    data: { id: contactMessage._id }
  });
});

exports.getAllMessages = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const messages = await ContactMessage.find(filter).sort('-createdAt');

  const unread = await ContactMessage.countDocuments({ status: 'unread' });

  res.status(200).json({
    success: true,
    results: messages.length,
    unread,
    data: { messages }
  });
});

exports.updateMessageStatus = catchAsync(async (req, res, next) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) return next(new AppError('Message not found.', 404));

  if (req.body.status) message.status = req.body.status;
  await message.save();

  res.status(200).json({
    success: true,
    message: 'Message status updated.',
    data: { message }
  });
});
