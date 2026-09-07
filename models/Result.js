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

// Auto calculate grade from percentage and pass/fail from the exam's passing mark.
resultSchema.pre('validate', async function () {
  const marks = Number(this.marks) || 0;
  let exam = this.exam;

  if (!exam || typeof exam !== 'object' || exam.totalMarks === undefined) {
    exam = this.exam
      ? await mongoose.model('Exam').findById(this.exam).select('totalMarks passingMarks').lean()
      : null;
  }

  const totalMarks = Number(exam?.totalMarks) || 100;
  const passingMarks = Number(exam?.passingMarks ?? 33);
  const percentage = totalMarks > 0 ? (marks / totalMarks) * 100 : 0;

  if (percentage >= 80) this.grade = 'A+';
  else if (percentage >= 70) this.grade = 'A';
  else if (percentage >= 60) this.grade = 'A-';
  else if (percentage >= 50) this.grade = 'B';
  else if (percentage >= 40) this.grade = 'C';
  else if (percentage >= 33) this.grade = 'D';
  else this.grade = 'F';

  this.status = marks >= passingMarks ? 'pass' : 'fail';
});

module.exports = mongoose.model('Result', resultSchema);
