const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Course title is required'],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Course description is required']
    },
    duration: {
      type: String,
      required: true,
      trim: true
    },
    classHours: {
      type: String,
      default: ''
    },
    fee: {
      type: Number,
      required: [true, 'Course fee is required'],
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    instructor: {
      type: String,
      default: ''
    },
    curriculum: {
      type: [String],
      default: []
    },
    requirements: {
      type: [String],
      default: []
    },
    benefits: {
      type: [String],
      default: []
    },
    image: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'upcoming'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

// Virtual for discounted price
courseSchema.virtual('discountedFee').get(function () {
  if (this.discount > 0) {
    return Math.round(this.fee - (this.fee * this.discount) / 100);
  }
  return this.fee;
});

courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

courseSchema.index({ slug: 1 });
courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ status: 1 });

module.exports = mongoose.model('Course', courseSchema);
