const router = require('express').Router();
const c = require('../controllers/blogController');
const { protect, restrictTo } = require('../middleware/auth'); // path আপনার প্রজেক্ট অনুযায়ী ঠিক করুন

// Admin রুট আগে রাখতে হবে, নাহলে '/:slug' এগুলো ধরে ফেলবে
router.get('/admin', protect, restrictTo('admin'), c.listAdmin);
router.get('/admin/stats', protect, restrictTo('admin'), c.adminStats); // '/admin/:id' এর আগে থাকতে হবে
router.get('/admin/:id', protect, restrictTo('admin'), c.adminOne);

router.get('/', c.listPublic);
router.post('/', protect, restrictTo('admin'), c.create);
router.patch('/:id', protect, restrictTo('admin'), c.update);
router.delete('/:id', protect, restrictTo('admin'), c.remove);

router.get('/:slug', c.publicOne);

module.exports = router;