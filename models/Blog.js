const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 180 },
    slug: { type: String, required: true, unique: true, index: true },
    excerpt: { type: String, required: true, maxlength: 350 },
    content: { type: String, required: true },
    coverImage: { type: String, default: '' },
    category: { type: String, required: true, trim: true, index: true },
    tags: [{ type: String, trim: true }],
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    seoTitle: { type: String, maxlength: 180 },
    seoDescription: { type: String, maxlength: 300 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    views: { type: Number, default: 0 },
    readTime: { type: Number, default: 1 },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// পাবলিক লিস্টের জন্য দ্রুত সর্টিং
blogSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);