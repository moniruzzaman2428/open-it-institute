const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    image: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['classroom', 'events', 'workshops', 'students', 'certificate'],
      default: 'classroom'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

gallerySchema.index({ category: 1 });

module.exports = mongoose.model('Gallery', gallerySchema);
