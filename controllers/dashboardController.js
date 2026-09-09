const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Admission = require('../models/Admission');
const Payment = require('../models/Payment');
const catchAsync = require('../utils/catchAsync');

const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

exports.getAdminDashboard = catchAsync(async (req, res) => {
  try {
    const now = new Date();
    const monthStart = getMonthStart(now);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const growthStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // console.log('📊 Fetching dashboard data...');
    // console.log('Growth start:', growthStart);

    // Parallel queries with error handling for each
    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      totalCourses,
      totalBatches,
      pendingAdmissions,
      totalAdmissions,
      totalPaymentsCount,
      revenueAgg,
      monthlyRevenueAgg,
      growthAgg,
      recentAdmissions,
      recentPayments,
    ] = await Promise.all([
      Student.countDocuments().catch(err => { console.error('Students count error:', err); return 0; }),
      Student.countDocuments({ status: 'active' }).catch(err => { console.error('Active students error:', err); return 0; }),
      Teacher.countDocuments().catch(err => { console.error('Teachers count error:', err); return 0; }),
      Course.countDocuments().catch(err => { console.error('Courses count error:', err); return 0; }),
      Batch.countDocuments().catch(err => { console.error('Batches count error:', err); return 0; }),
      Admission.countDocuments({ status: 'pending' }).catch(err => { console.error('Pending admissions error:', err); return 0; }),
      Admission.countDocuments().catch(err => { console.error('Total admissions error:', err); return 0; }),
      Payment.countDocuments().catch(err => { console.error('Payments count error:', err); return 0; }),
      Payment.aggregate([
        { $match: { status: { $in: ['paid', 'partial'] } } },
        { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).catch(err => { console.error('Revenue aggregation error:', err); return [{ amount: 0, count: 0 }]; }),
      Payment.aggregate([
        {
          $match: {
            status: { $in: ['paid', 'partial'] },
            paymentDate: { $gte: monthStart, $lt: nextMonthStart },
          },
        },
        { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).catch(err => { console.error('Monthly revenue error:', err); return [{ amount: 0, count: 0 }]; }),
      Student.aggregate([
        { $match: { createdAt: { $gte: growthStart } } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]).catch(err => { console.error('Growth aggregation error:', err); return []; }),
      // Recent admissions with safe population
      Admission.find()
        .populate({
          path: 'course',
          select: 'title slug',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'batch',
          select: 'name time',
          options: { strictPopulate: false }
        })
        .sort('-createdAt')
        .limit(6)
        .lean()
        .catch(err => { console.error('Recent admissions error:', err); return []; }),
      // Recent payments with safe population
      Payment.find({ status: { $in: ['paid', 'partial'] } })
        .populate({
          path: 'student',
          select: 'name studentId',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'course',
          select: 'title',
          options: { strictPopulate: false }
        })
        .sort('-paymentDate')
        .limit(5)
        .lean()
        .catch(err => { console.error('Recent payments error:', err); return []; }),
    ]);

    // Process student growth data
    const studentGrowth = [];
    for (let i = 11; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const monthNumber = date.getMonth() + 1;
      const found = (growthAgg || []).find(
        (row) => row._id && row._id.year === year && row._id.month === monthNumber
      );

      studentGrowth.push({
        key: `${year}-${String(monthNumber).padStart(2, '0')}`,
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        year,
        monthIndex: date.getMonth(),
        count: found?.count || 0,
      });
    }

    const revenue = (revenueAgg && revenueAgg[0]) || { amount: 0, count: 0 };
    const monthlyRevenue = (monthlyRevenueAgg && monthlyRevenueAgg[0]) || { amount: 0, count: 0 };

    // Clean admissions data for frontend
    const cleanAdmissions = (recentAdmissions || []).map(admission => ({
      _id: admission._id,
      applicationId: admission.applicationId,
      studentName: admission.studentName || 'Unknown',
      fatherName: admission.fatherName || '',
      motherName: admission.motherName || '',
      phone: admission.phone || '',
      email: admission.email || '',
      gender: admission.gender || '',
      education: admission.education || '',
      address: admission.address || '',
      course: admission.course || { title: 'N/A' },
      batch: admission.batch || null,
      status: admission.status || 'pending',
      remarks: admission.remarks || '',
      createdAt: admission.createdAt || admission.appliedAt || new Date(),
      appliedAt: admission.appliedAt || admission.createdAt || new Date(),
    }));

    // Clean payments data
    const cleanPayments = (recentPayments || []).map(payment => ({
      _id: payment._id,
      amount: payment.amount || 0,
      status: payment.status || 'pending',
      student: payment.student || { name: 'Unknown' },
      course: payment.course || { title: 'N/A' },
      paymentDate: payment.paymentDate || payment.createdAt || new Date(),
    }));

    const responseData = {
      generatedAt: new Date().toISOString(),
      stats: {
        totalStudents: totalStudents || 0,
        activeStudents: activeStudents || 0,
        teachers: totalTeachers || 0,
        courses: totalCourses || 0,
        batches: totalBatches || 0,
        pendingAdmissions: pendingAdmissions || 0,
        totalPayments: revenue.amount || 0,
        successfulTransactions: revenue.count || 0,
        monthlyRevenue: monthlyRevenue.amount || 0,
        monthlyTransactions: monthlyRevenue.count || 0,
      },
      collectionCounts: {
        students: totalStudents || 0,
        teachers: totalTeachers || 0,
        courses: totalCourses || 0,
        batches: totalBatches || 0,
        admissions: totalAdmissions || 0,
        payments: totalPaymentsCount || 0,
      },
      studentGrowth,
      recentAdmissions: cleanAdmissions,
      recentPayments: cleanPayments,
    };

    // console.log('✅ Dashboard data fetched successfully');
    // console.log('📈 Student growth data points:', studentGrowth.length);
    // console.log('📋 Recent admissions:', cleanAdmissions.length);

    res.status(200).json({
      success: true,
      data: responseData,
    });

  } catch (error) {
    console.error('❌ Dashboard Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard data',
      error: error.message,
    });
  }
});