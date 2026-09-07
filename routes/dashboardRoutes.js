const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Protect all dashboard routes - only admin can access
router.use(protect);
router.use(restrictTo('admin'));

// GET /api/dashboard/admin
router.get('/admin', dashboardController.getAdminDashboard);

module.exports = router;