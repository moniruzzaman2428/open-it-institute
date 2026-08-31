const express = require('express');
const batchController = require('../controllers/batchController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(restrictTo('admin', 'teacher'), batchController.getAllBatches)
  .post(restrictTo('admin'), batchController.createBatch);

router
  .route('/:id')
  .get(restrictTo('admin', 'teacher'), batchController.getBatch)
  .patch(restrictTo('admin'), batchController.updateBatch)
  .delete(restrictTo('admin'), batchController.deleteBatch);

module.exports = router;
