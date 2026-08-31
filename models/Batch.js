const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Batch name is required'],
      trim: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    days: {
      type: [String],
      required: true,
      enum: {
        values: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        message: 'Invalid day'
      }
    },
    time: {
      type: String,
      required: true,
      trim: true
    },
    room: {
      type: String,
      default: ''
    },
    maximumStudents: {
      type: Number,
      required: true,
      min: 1
    },
    currentStudents: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming'
    }
  },
  {
    timestamps: true
  }
);

batchSchema.index({ course: 1, status: 1 });
batchSchema.index({ teacher: 1 });

module.exports = mongoose.model('Batch', batchSchema);
