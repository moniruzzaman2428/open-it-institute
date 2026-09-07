
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
  galleryController.createGalleryItem
);


router.patch(
  '/:id',
  protect,
  restrictTo('admin'),
  upload.single('image'),
  galleryController.updateGalleryItem
);


router.delete(
  '/:id',
  protect,
  restrictTo('admin'),
  galleryController.deleteGalleryItem
);


module.exports = router;
