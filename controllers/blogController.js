
const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
const Blog = require('../models/Blog');
const CATEGORIES = require('../config/blogCategories');

/* ---------- Helpers ---------- */

// HTML sanitization: article formatting অনুমোদন করে,
// কিন্তু script, event handler ও অননুমোদিত CSS সরিয়ে দেয়।
const safeContent = (html) =>
  sanitizeHtml(typeof html === 'string' ? html : '', {
    allowedTags: [
      ...new Set([
        ...sanitizeHtml.defaults.allowedTags,
        'img',
        'h1',
        'h2',
        'h3',
        'h4',
        'figure',
        'figcaption',
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'hr',
      ]),
    ],

    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['class', 'style'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      a: ['href', 'name', 'target', 'rel'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },

    allowedStyles: {
      '*': {
        color: [
          /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/,
        ],

        'background-color': [
          /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/,
        ],

        'font-size': [
          /^\d+(\.\d+)?(px|rem|em|%)$/,
        ],

        'font-weight': [
          /^(normal|bold|[1-9]00)$/,
        ],

        'font-style': [
          /^(normal|italic|oblique)$/,
        ],

        'text-align': [
          /^(left|right|center|justify)$/,
        ],

        'line-height': [
          /^\d+(\.\d+)?(px|rem|em|%)?$/,
        ],

        margin: [
          /^(auto|0|\d+(\.\d+)?(px|rem|em|%))( (auto|0|\d+(\.\d+)?(px|rem|em|%))){0,3}$/,
        ],

        'margin-top': [
          /^(auto|0|\d+(\.\d+)?(px|rem|em|%))$/,
        ],

        'margin-bottom': [
          /^(auto|0|\d+(\.\d+)?(px|rem|em|%))$/,
        ],

        padding: [
          /^(0|\d+(\.\d+)?(px|rem|em|%))( (0|\d+(\.\d+)?(px|rem|em|%))){0,3}$/,
        ],

        'padding-left': [
          /^(0|\d+(\.\d+)?(px|rem|em|%))$/,
        ],

        'padding-right': [
          /^(0|\d+(\.\d+)?(px|rem|em|%))$/,
        ],

        'padding-top': [
          /^(0|\d+(\.\d+)?(px|rem|em|%))$/,
        ],

        'padding-bottom': [
          /^(0|\d+(\.\d+)?(px|rem|em|%))$/,
        ],

        border: [
          /^(none|0|\d+(\.\d+)?(px|rem) (solid|dashed|dotted) (#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}))$/,
        ],

        'border-left': [
          /^(none|0|\d+(\.\d+)?(px|rem) (solid|dashed|dotted) (#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}))$/,
        ],

        'border-radius': [
          /^(0|\d+(\.\d+)?(px|rem|em|%))$/,
        ],

        'max-width': [
          /^\d+(\.\d+)?(px|rem|em|%)$/,
        ],

        width: [
          /^\d+(\.\d+)?(px|rem|em|%)$/,
        ],

        height: [
          /^\d+(\.\d+)?(px|rem|em|%)$/,
        ],
      },
    },

    allowedSchemes: ['http', 'https', 'mailto'],

    // JavaScript URL নিষিদ্ধ। Image-এর জন্য data URL অনুমোদিত নয়।
    allowProtocolRelative: false,

    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.target === '_blank'
            ? { rel: 'noopener noreferrer' }
            : {}),
        },
      }),
    },
  });

// বাংলা ও অন্যান্য Unicode অক্ষর সমর্থন করে slug তৈরি।
const toSlug = (text = '') =>
  String(text)
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');

// Duplicate slug এড়ায়। Database unique index-ও প্রয়োজন।
const uniqueSlug = async (base, excludeId) => {
  const root =
    toSlug(base) || `article-${Date.now().toString(36)}`;

  const filter = excludeId
    ? { _id: { $ne: excludeId } }
    : {};

  let slug = root;
  let n = 1;

  while (await Blog.exists({ ...filter, slug })) {
    n += 1;
    const suffix = `-${n}`;
    slug = `${root.slice(0, 100 - suffix.length).replace(/-+$/g, '')}${suffix}`;
  }

  return slug;
};

// HTML tag বাদ দিয়ে আনুমানিক reading time হিসাব।
const calcReadTime = (html) => {
  const text = sanitizeHtml(String(html || ''), {
    allowedTags: [],
    allowedAttributes: {},
  });

  const words = text.trim()
    ? text.trim().split(/\s+/u).length
    : 0;

  return Math.max(1, Math.ceil(words / 200));
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FIELDS = [
  'title',
  'excerpt',
  'content',
  'coverImage',
  'category',
  'tags',
  'featured',
  'status',
  'seoTitle',
  'seoDescription',
];

// শুধু অনুমোদিত field নেওয়া হয়।
const pick = (body = {}) => {
  const data = {};

  for (const field of FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }

  if (typeof data.title === 'string') {
    data.title = data.title.trim();
  }

  if (typeof data.excerpt === 'string') {
    data.excerpt = data.excerpt.trim();
  }

  if (typeof data.content === 'string') {
    data.content = safeContent(data.content);
    data.readTime = calcReadTime(data.content);
  }

  if (data.tags !== undefined && Array.isArray(data.tags)) {
    data.tags = [
      ...new Set(
        data.tags
          .filter((tag) => typeof tag === 'string')
          .map((tag) => tag.trim())
          .filter(Boolean)
      ),
    ].slice(0, 15);
  }

  // String "true"/"false" সঠিকভাবে convert করা।
  if (data.featured === 'true') data.featured = true;
  if (data.featured === 'false') data.featured = false;

  return data;
};

// Server-side validation
const validate = (data, { partial = false } = {}) => {
  const requiredFields = [
    'title',
    'excerpt',
    'content',
    'category',
  ];

  if (!partial) {
    for (const field of requiredFields) {
      if (
        typeof data[field] !== 'string' ||
        !data[field].trim()
      ) {
        return `${field} is required`;
      }
    }
  }

  if (
    data.title !== undefined &&
    (typeof data.title !== 'string' ||
      !data.title.trim() ||
      data.title.length > 200)
  ) {
    return 'Title must be 1-200 characters';
  }

  if (
    data.excerpt !== undefined &&
    (typeof data.excerpt !== 'string' ||
      !data.excerpt.trim() ||
      data.excerpt.length > 500)
  ) {
    return 'Excerpt must be 1-500 characters';
  }

  if (
    data.content !== undefined &&
    (typeof data.content !== 'string' ||
      !data.content.trim())
  ) {
    return 'Content cannot be empty';
  }

  if (
    data.category !== undefined &&
    (typeof data.category !== 'string' ||
      !CATEGORIES.includes(data.category))
  ) {
    return 'Invalid category';
  }

  if (
    data.status !== undefined &&
    !['draft', 'published'].includes(data.status)
  ) {
    return 'Invalid status';
  }

  if (
    data.featured !== undefined &&
    typeof data.featured !== 'boolean'
  ) {
    return 'Featured must be true or false';
  }

  if (
    data.tags !== undefined &&
    !Array.isArray(data.tags)
  ) {
    return 'Tags must be an array';
  }

  if (
    data.coverImage !== undefined &&
    (typeof data.coverImage !== 'string' ||
      data.coverImage.length > 2048)
  ) {
    return 'Invalid cover image';
  }

  if (
    data.seoTitle !== undefined &&
    (typeof data.seoTitle !== 'string' ||
      data.seoTitle.length > 200)
  ) {
    return 'SEO title must be at most 200 characters';
  }

  if (
    data.seoDescription !== undefined &&
    (typeof data.seoDescription !== 'string' ||
      data.seoDescription.length > 500)
  ) {
    return 'SEO description must be at most 500 characters';
  }

  return null;
};

// Async error handler
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        message: Object.values(err.errors)
          .map((error) => error.message)
          .join(', '),
      });
    }

    if (err.code === 11000) {
      return res.status(409).json({
        message: 'Duplicate value. Please try again.',
      });
    }

    return next(err);
  });

const invalidId = (id) => !mongoose.isValidObjectId(id);

const parsePage = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isSafeInteger(number) && number > 0
    ? Math.min(number, 1000000)
    : 1;
};

/* ---------- Public ---------- */

// GET /api/blogs
exports.listPublic = wrap(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = Math.min(
    24,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 9)
  );

  const filter = { status: 'published' };

  if (req.query.category) {
    filter.category = String(req.query.category);
  }

  if (req.query.tag) {
    filter.tags = String(req.query.tag);
  }

  if (req.query.featured === 'true') {
    filter.featured = true;
  }

  if (req.query.search) {
    const term = String(req.query.search).trim().slice(0, 80);

    if (term) {
      const regex = new RegExp(escapeRegex(term), 'i');

      filter.$or = [
        { title: regex },
        { excerpt: regex },
        { category: regex },
        { tags: regex },
      ];
    }
  }

  const [blogs, total] = await Promise.all([
    Blog.find(filter)
      .select('-content')
      .sort({ publishedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Blog.countDocuments(filter),
  ]);

  res.json({
    blogs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/blogs/:slug
exports.publicOne = wrap(async (req, res) => {
  const blog = await Blog.findOneAndUpdate(
    {
      slug: req.params.slug,
      status: 'published',
    },
    { $inc: { views: 1 } },
    { new: true }
  ).lean();

  if (!blog) {
    return res.status(404).json({
      message: 'Blog not found',
    });
  }

  const related = await Blog.find({
    status: 'published',
    category: blog.category,
    _id: { $ne: blog._id },
  })
    .select('-content')
    .sort({ publishedAt: -1, _id: -1 })
    .limit(3)
    .lean();

  res.json({ blog, related });
});

/* ---------- Admin ---------- */

// GET /api/blogs/admin
exports.listAdmin = wrap(async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(req.query.limit, 10) || 12)
  );

  const filter = {};

  if (['draft', 'published'].includes(req.query.status)) {
    filter.status = req.query.status;
  }

  if (req.query.search) {
    const term = String(req.query.search).slice(0, 80);

    if (term.trim()) {
      filter.title = {
        $regex: escapeRegex(term),
        $options: 'i',
      };
    }
  }

  const [blogs, total, stats] = await Promise.all([
    Blog.find(filter)
      .select('-content')
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Blog.countDocuments(filter),

    Blog.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  res.json({
    blogs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats,
  });
});

// GET /api/blogs/admin/:id
exports.adminOne = wrap(async (req, res) => {
  if (invalidId(req.params.id)) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  res.json({ blog });
});

// POST /api/blogs
exports.create = wrap(async (req, res) => {
  const body = req.body || {};
  const data = pick(body);

  const error = validate(data);

  if (error) {
    return res.status(400).json({ message: error });
  }

  const customSlug =
    typeof body.slug === 'string' ? toSlug(body.slug) : '';

  data.slug = await uniqueSlug(
    customSlug || toSlug(data.title)
  );

  if (data.status === 'published') {
    data.publishedAt = new Date();
  }

  if (req.user?._id) {
    data.author = req.user._id;
  }

  const blog = await Blog.create(data);

  res.status(201).json({ blog });
});

// PATCH/PUT /api/blogs/:id
exports.update = wrap(async (req, res) => {
  if (invalidId(req.params.id)) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  const body = req.body || {};
  const data = pick(body);

  const error = validate(data, { partial: true });

  if (error) {
    return res.status(400).json({ message: error });
  }

  if (body.slug !== undefined) {
    if (typeof body.slug !== 'string') {
      return res.status(400).json({
        message: 'Slug must be a string',
      });
    }

    const nextSlug = toSlug(body.slug);

    if (!nextSlug) {
      return res.status(400).json({
        message: 'Slug cannot be empty',
      });
    }

    if (nextSlug !== blog.slug) {
      data.slug = await uniqueSlug(nextSlug, blog._id);
    }
  }

  if (
    data.status === 'published' &&
    !blog.publishedAt
  ) {
    data.publishedAt = new Date();
  }

  Object.assign(blog, data);

  await blog.save();

  res.json({ blog });
});

// DELETE /api/blogs/:id
exports.remove = wrap(async (req, res) => {
  if (invalidId(req.params.id)) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  const blog = await Blog.findByIdAndDelete(req.params.id);

  if (!blog) {
    return res.status(404).json({ message: 'Blog not found' });
  }

  res.json({ message: 'Blog deleted' });
});

// GET /api/blogs/admin/stats
exports.adminStats = wrap(async (req, res) => {
  const [
    byStatus,
    viewsAgg,
    byCategory,
    recent,
    top,
  ] = await Promise.all([
    Blog.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),

    Blog.aggregate([
      {
        $group: {
          _id: null,
          views: { $sum: '$views' },
        },
      },
    ]),

    Blog.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),

    Blog.find()
      .select('title slug status category views updatedAt')
      .sort({ updatedAt: -1, _id: -1 })
      .limit(5)
      .lean(),

    Blog.find({ status: 'published' })
      .select('title slug category views')
      .sort({ views: -1, _id: -1 })
      .limit(5)
      .lean(),
  ]);

  const count = (status) =>
    byStatus.find((item) => item._id === status)?.count || 0;

  res.json({
    total: byStatus.reduce((sum, item) => sum + item.count, 0),
    published: count('published'),
    draft: count('draft'),
    totalViews: viewsAgg[0]?.views || 0,
    byCategory,
    recent,
    top,
  });
});

// একই module.exports object-এ সব controller export থাকবে।
exports.safeContent = safeContent;
