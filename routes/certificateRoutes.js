const express = require('express');
const certificateController = require('../controllers/certificateController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Public verification (no auth)
router.get('/verify/:certificateId', certificateController.verifyCertificate);

// Protected
router.use(protect);

router
  .route('/')
  .get(restrictTo('admin', 'student'), certificateController.getAllCertificates)
  .post(restrictTo('admin'), certificateController.createCertificate);

router.patch(
  '/:id/revoke',
  restrictTo('admin'),
  certificateController.revokeCertificate
);

router
  .route('/:id')
  .patch(restrictTo('admin'), certificateController.updateCertificate)
  .delete(restrictTo('admin'), certificateController.deleteCertificate);

module.exports = router;
