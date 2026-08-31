const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
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
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bkash', 'nagad', 'bank'],
      required: true
    },
    transactionId: {
      type: String,
      default: ''
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['paid', 'partial', 'due', 'cancelled'],
      default: 'paid'
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    remarks: {
      type: String,
      default: ''
    },
    // Snapshot of fee details at payment time
    totalFee: {
      type: Number,
      required: true
    },
    paidAmount: {
      type: Number,
      required: true
    },
    dueAmount: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ student: 1, course: 1 });
paymentSchema.index({ receiptNumber: 1 });
paymentSchema.index({ paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
