const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true
    },
    marks: {
      type: Number,
      required: true,
      min: 0
    },
    grade: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pass', 'fail'],
      required: true
    },
    publishedAt: {
      type: Date
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isPublished: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Unique result per student per exam
resultSchema.index({ student: 1, exam: 1 }, { unique: true });

// Auto calculate grade
resultSchema.pre('validate', function (next) {
  const marks = this.marks;
  if (marks >= 80) this.grade = 'A+';
  else if (marks >= 70) this.grade = 'A';
  else if (marks >= 60) this.grade = 'A-';
  else if (marks >= 50) this.grade = 'B';
  else if (marks >= 40) this.grade = 'C';
  else if (marks >= 33) this.grade = 'D';
  else this.grade = 'F';

  this.status = marks >= 33 ? 'pass' : 'fail';
  next();
});

module.exports = mongoose.model('Result', resultSchema);
