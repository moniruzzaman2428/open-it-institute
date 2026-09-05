
const express = require('express');

const galleryController = require('../controllers/galleryController');
const {
  protect,
  restrictTo,
  optionalAuth
} = require('../middleware/auth');

const upload = require('../middleware/upload');

const router = express.Router();


// ===============================
// PUBLIC
// ===============================

router.get(
  '/',
  optionalAuth,
  galleryController.getAllGallery
);


// ===============================
// ADMIN
// ===============================

router.post(
  '/',
  protect,
  restrictTo('admin'),
  upload.single('image'),
  (req, res, next) => {
    console.log('========== MULTER DEBUG ==========');
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);
    console.log('==================================');
    next();
  },
  galleryController.createGalleryItem
);


router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  galleryController.deleteGalleryItem
);


module.exports = router;
