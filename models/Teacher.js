const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: [true, 'Teacher name is required'],
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    photo: {
      type: String,
      default: ''
    },
    designation: {
      type: String,
      required: true,
      trim: true
    },
    skills: {
      type: [String],
      default: []
    },
    experience: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    },
    assignedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
      }
    ],
    assignedBatches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch'
      }
    ],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

teacherSchema.index({ name: 'text', email: 'text', phone: 'text' });

module.exports = mongoose.model('Teacher', teacherSchema);
