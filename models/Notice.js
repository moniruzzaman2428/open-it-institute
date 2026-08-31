const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Notice description is required']
    },
    category: {
      type: String,
      enum: ['general', 'admission', 'exam', 'class', 'result', 'holiday'],
      default: 'general'
    },
    publishDate: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

noticeSchema.index({ status: 1, publishDate: -1 });
noticeSchema.index({ category: 1 });

module.exports = mongoose.model('Notice', noticeSchema);
