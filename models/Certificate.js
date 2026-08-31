const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true
    },
    verificationCode: {
      type: String,
      required: true,
      unique: true
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    completionDate: {
      type: Date,
      required: true
    },
    issueDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['valid', 'revoked', 'expired'],
      default: 'valid'
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    duration: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

certificateSchema.index({ certificateId: 1 });
certificateSchema.index({ verificationCode: 1 });
certificateSchema.index({ student: 1, course: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);
