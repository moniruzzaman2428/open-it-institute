const express = require('express');
const galleryController = require('../controllers/galleryController');
const { protect, restrictTo, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public
router.get('/', optionalAuth, galleryController.getAllGallery);

// Admin
router.use(protect);
router.use(restrictTo('admin'));

router.post('/', galleryController.createGalleryItem);
router.delete('/:id', galleryController.deleteGalleryItem);

module.exports = router;
