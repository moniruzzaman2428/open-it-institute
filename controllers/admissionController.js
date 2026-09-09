const mongoose = require('mongoose');

const Admission = require('../models/Admission');
const User = require('../models/User');
const Student = require('../models/Student');
const Course = require('../models/Course');
const Batch = require('../models/Batch');

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const APIFeatures = require('../utils/apiFeatures');

const {
  generateApplicationId,
  generateStudentId,
} = require('../utils/generateId');


// =========================================================
// HELPER: Check ObjectId
// =========================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};


// =========================================================
// HELPER: Validate Batch
// =========================================================
// এখানে batchId না থাকলে কোনো batch auto-select করা হবে না.
// Batch অবশ্যই Admin-এর selected batch হতে হবে.
// =========================================================

const getValidBatchForCourse = async (batchId, courseId) => {

  // -------------------------------------------------------
  // Batch is required
  // -------------------------------------------------------

  if (!batchId) {
    throw new AppError(
      'Please select a batch before approving this admission.',
      400
    );
  }


  // -------------------------------------------------------
  // Validate Batch ID
  // -------------------------------------------------------

  if (!isValidObjectId(batchId)) {
    throw new AppError(
      'Invalid batch ID format.',
      400
    );
  }


  // -------------------------------------------------------
  // Find Batch
  // -------------------------------------------------------

  const batch = await Batch.findById(batchId)
    .populate('teacher', 'name email');


  if (!batch) {
    throw new AppError(
      'Selected batch not found.',
      404
    );
  }


  // -------------------------------------------------------
  // Check Course
  // -------------------------------------------------------

  if (
    String(batch.course) !==
    String(courseId)
  ) {
    throw new AppError(
      'Selected batch does not belong to the selected course.',
      400
    );
  }


  // -------------------------------------------------------
  // Check Batch Status
  // -------------------------------------------------------

  if (
    !['upcoming', 'ongoing'].includes(batch.status)
  ) {
    throw new AppError(
      'Selected batch is not open for admission.',
      400
    );
  }


  // -------------------------------------------------------
  // Check Teacher
  // -------------------------------------------------------

  if (!batch.teacher) {
    throw new AppError(
      'Selected batch does not have a teacher assigned. Please assign a teacher first.',
      400
    );
  }


  // -------------------------------------------------------
  // Check Capacity
  // -------------------------------------------------------

  const currentStudents =
    Number(batch.currentStudents || 0);

  const maximumStudents =
    Number(batch.maximumStudents || 0);


  if (
    maximumStudents > 0 &&
    currentStudents >= maximumStudents
  ) {
    throw new AppError(
      `Selected batch is already full. Maximum capacity: ${maximumStudents}.`,
      400
    );
  }


  return batch;
};


// =========================================================
// PUBLIC: CREATE ADMISSION
// =========================================================

exports.createAdmission = catchAsync(
  async (req, res, next) => {

    const {
      studentName,
      fatherName,
      motherName,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      education,
      course,
      batch,
      photo,
    } = req.body;


    // -----------------------------------------------------
    // Validate Required Fields
    // -----------------------------------------------------

    if (
      !studentName ||
      !fatherName ||
      !motherName ||
      !dateOfBirth ||
      !gender ||
      !phone ||
      !email ||
      !address ||
      !education ||
      !course
    ) {
      return next(
        new AppError(
          'Please fill all required fields.',
          400
        )
      );
    }


    // -----------------------------------------------------
    // Find Course
    // -----------------------------------------------------

    let courseDoc = null;


    if (isValidObjectId(course)) {

      courseDoc =
        await Course.findById(course);

    } else {

      courseDoc =
        await Course.findOne({
          slug: course,
        });

    }


    if (!courseDoc) {
      return next(
        new AppError(
          'Selected course not found.',
          404
        )
      );
    }


    // -----------------------------------------------------
    // Validate Batch If Provided
    // -----------------------------------------------------

    if (batch) {

      await getValidBatchForCourse(
        batch,
        courseDoc._id
      );

    }


    // -----------------------------------------------------
    // Check Existing Pending Application
    // -----------------------------------------------------

    const existing =
      await Admission.findOne({
        $or: [
          { phone },
          {
            email:
              email.toLowerCase(),
          },
        ],
        status: 'pending',
      });


    if (existing) {
      return next(
        new AppError(
          'You already have a pending application. Please wait for review.',
          400
        )
      );
    }


    // -----------------------------------------------------
    // Generate Unique Application ID
    // -----------------------------------------------------

    let applicationId;
    let isUnique = false;


    while (!isUnique) {

      applicationId =
        generateApplicationId();


      const exists =
        await Admission.findOne({
          applicationId,
        });


      if (!exists) {
        isUnique = true;
      }
    }


    // -----------------------------------------------------
    // Create Admission
    // -----------------------------------------------------

    const admission =
      await Admission.create({

        applicationId,

        studentName,

        fatherName,

        motherName,

        dateOfBirth,

        gender,

        phone,

        email:
          email.toLowerCase(),

        address,

        education,

        course:
          courseDoc._id,

        batch:
          batch || undefined,

        photo:
          photo || '',

        status:
          'pending',
      });


    // -----------------------------------------------------
    // Populate Course
    // -----------------------------------------------------

    await admission.populate(
      'course',
      'title slug'
    );


    // -----------------------------------------------------
    // Response
    // -----------------------------------------------------

    return res.status(201).json({

      success: true,

      message:
        'Admission application submitted successfully!',

      data: {

        applicationId:
          admission.applicationId,

        studentName:
          admission.studentName,

        course:
          admission.course?.title,

        status:
          admission.status,

        appliedAt:
          admission.appliedAt,
      },
    });
  }
);


// =========================================================
// ADMIN: GET ALL ADMISSIONS
// =========================================================

exports.getAllAdmissions = catchAsync(
  async (req, res, next) => {

    const features =
      new APIFeatures(

        Admission.find()

          .populate(
            'course',
            'title slug'
          )

          .populate(
            'batch',
            'name time days status currentStudents maximumStudents teacher'
          )

          .populate(
            'reviewedBy',
            'name'
          ),

        req.query
      )

        .filter()

        .search([
          'studentName',
          'phone',
          'email',
          'applicationId',
        ])

        .sort()

        .paginate();


    const admissions =
      await features.query;


    const total =
      await Admission.countDocuments();


    // -----------------------------------------------------
    // Statistics
    // -----------------------------------------------------

    const pending =
      await Admission.countDocuments({
        status: 'pending',
      });


    const approved =
      await Admission.countDocuments({
        status: 'approved',
      });


    const rejected =
      await Admission.countDocuments({
        status: 'rejected',
      });


    // -----------------------------------------------------
    // Response
    // -----------------------------------------------------

    return res.status(200).json({

      success: true,

      results:
        admissions.length,

      total,

      stats: {

        pending,

        approved,

        rejected,
      },

      data: {

        admissions,
      },
    });
  }
);


// =========================================================
// ADMIN: GET SINGLE ADMISSION
// =========================================================

exports.getAdmission = catchAsync(
  async (req, res, next) => {

    const admission =
      await Admission.findById(
        req.params.id
      )

        .populate(
          'course',
          'title slug fee duration'
        )

        .populate(
          'batch',
          'name time days status currentStudents maximumStudents teacher'
        )

        .populate(
          'reviewedBy',
          'name email'
        );


    if (!admission) {

      return next(
        new AppError(
          'Admission application not found.',
          404
        )
      );

    }


    return res.status(200).json({

      success: true,

      data: {

        admission,
      },
    });
  }
);


// =========================================================
// ADMIN: GET AVAILABLE BATCHES FOR COURSE
// =========================================================
// GET /api/admissions/batches/:courseId
//
// এই endpoint শুধুমাত্র selected course-এর available
// batchগুলো frontend-কে পাঠাবে.
// =========================================================

exports.getAdmissionBatches = catchAsync(
  async (req, res, next) => {

    const { courseId } =
      req.params;


    // -----------------------------------------------------
    // Validate Course ID
    // -----------------------------------------------------

    if (!isValidObjectId(courseId)) {

      return next(
        new AppError(
          'Invalid course ID.',
          400
        )
      );

    }


    // -----------------------------------------------------
    // Check Course Exists
    // -----------------------------------------------------

    const course =
      await Course.findById(
        courseId
      );


    if (!course) {

      return next(
        new AppError(
          'Course not found.',
          404
        )
      );

    }


    // -----------------------------------------------------
    // Find Available Batches
    // -----------------------------------------------------

    const batches =
      await Batch.find({

        course:
          courseId,

        status: {
          $in: [
            'upcoming',
            'ongoing',
          ],
        },

        $expr: {
          $lt: [
            '$currentStudents',
            '$maximumStudents',
          ],
        },

      })

        .populate(
          'teacher',
          'name email'
        )

        .sort({
          startDate: 1,
          createdAt: 1,
        });


    // -----------------------------------------------------
    // Only batches with teacher
    // -----------------------------------------------------

    const availableBatches =
      batches.filter(
        (batch) =>
          batch.teacher
      );


    // -----------------------------------------------------
    // Response
    // -----------------------------------------------------

    return res.status(200).json({

      success: true,

      results:
        availableBatches.length,

      data: {

        batches:
          availableBatches,
      },
    });
  }
);


// =========================================================
// ADMIN: UPDATE / APPROVE / REJECT
// =========================================================

exports.updateAdmission = catchAsync(
  async (req, res, next) => {

    const {
      status,
      remarks,
      batch,
    } = req.body;


    // -----------------------------------------------------
    // Find Admission
    // -----------------------------------------------------

    const admission =
      await Admission.findById(
        req.params.id
      )

        .populate(
          'course',
          'title slug fee duration'
        );


    if (!admission) {

      return next(
        new AppError(
          'Admission application not found.',
          404
        )
      );

    }


    // =====================================================
    // ALREADY PROCESSED CHECK
    // =====================================================

    if (
      admission.status !== 'pending' &&
      status
    ) {

      return next(
        new AppError(
          `This application is already ${admission.status}.`,
          400
        )
      );

    }


    // =====================================================
    // APPROVE
    // =====================================================

    if (status === 'approved') {


      // ---------------------------------------------------
      // 1. Batch MUST be selected
      // ---------------------------------------------------

      if (!batch) {

        return next(
          new AppError(
            'Please select a batch before approving this admission.',
            400
          )
        );

      }


      // ---------------------------------------------------
      // 2. Validate Selected Batch
      // ---------------------------------------------------

      let selectedBatch;


      try {

        selectedBatch =
          await getValidBatchForCourse(
            batch,
            admission.course._id
          );

      } catch (error) {

        return next(
          new AppError(
            error.message ||
              'Selected batch is not available.',
            error.statusCode || 400
          )
        );

      }


      // ---------------------------------------------------
      // 3. Final Batch Check
      // ---------------------------------------------------

      if (!selectedBatch) {

        return next(
          new AppError(
            'Selected batch was not found.',
            404
          )
        );

      }


      // ---------------------------------------------------
      // 4. Teacher Check
      // ---------------------------------------------------

      if (!selectedBatch.teacher) {

        return next(
          new AppError(
            'Selected batch does not have a teacher assigned.',
            400
          )
        );

      }


      // ---------------------------------------------------
      // 5. Capacity Check
      // ---------------------------------------------------

      const currentStudents =
        Number(
          selectedBatch.currentStudents || 0
        );


      const maximumStudents =
        Number(
          selectedBatch.maximumStudents || 0
        );


      if (
        maximumStudents > 0 &&
        currentStudents >= maximumStudents
      ) {

        return next(
          new AppError(
            'Selected batch is already full. Please select another batch.',
            400
          )
        );

      }


      // ===================================================
      // USER CHECK
      // ===================================================

      let user =
        await User.findOne({

          $or: [

            {
              email:
                admission.email,
            },

            {
              phone:
                admission.phone,
            },

          ],

        });


      // ---------------------------------------------------
      // Existing User Role Check
      // ---------------------------------------------------

      if (
        user &&
        user.role !== 'student'
      ) {

        return next(
          new AppError(
            'A user with this email/phone already exists with a different role.',
            400
          )
        );

      }


      // ===================================================
      // EXISTING STUDENT CHECK
      // ===================================================

      let student =
        user
          ? await Student.findOne({
              userId:
                user._id,
            })
          : null;


      if (student) {

        return next(
          new AppError(
            'A student profile already exists for this admission/user.',
            400
          )
        );

      }


      // ===================================================
      // CREATE USER
      // =====================================================

      if (!user) {

        user =
          await User.create({

            name:
              admission.studentName,

            email:
              admission.email,

            phone:
              admission.phone,

            password:
              admission.phone,

            role:
              'student',

            status:
              'active',

            profileImage:
              admission.photo || '',
          });

      }


      // ===================================================
      // GENERATE STUDENT ID
      // =====================================================

      let studentId;

      let studentIdUnique = false;


      while (!studentIdUnique) {

        studentId =
          generateStudentId();


        const exists =
          await Student.findOne({
            studentId,
          });


        if (!exists) {

          studentIdUnique = true;

        }

      }


      // ===================================================
      // CREATE STUDENT
      // =====================================================

      student =
        await Student.create({

          userId:
            user._id,

          studentId,

          name:
            admission.studentName,

          fatherName:
            admission.fatherName,

          motherName:
            admission.motherName,

          dateOfBirth:
            admission.dateOfBirth,

          gender:
            admission.gender,

          phone:
            admission.phone,

          email:
            admission.email,

          address:
            admission.address,

          education:
            admission.education,

          course:
            admission.course._id,

          // ⭐ ADMIN SELECTED BATCH
          batch:
            selectedBatch._id,

          photo:
            admission.photo || '',

          status:
            'active',

          admissionDate:
            new Date(),
        });


      // ===================================================
      // INCREASE BATCH STUDENT COUNT
      // =====================================================

      await Batch.findByIdAndUpdate(

        selectedBatch._id,

        {
          $inc: {
            currentStudents: 1,
          },
        }

      );


      // ===================================================
      // UPDATE ADMISSION
      // =====================================================

      admission.status =
        'approved';


      admission.reviewedBy =
        req.user.id;


      admission.reviewedAt =
        new Date();


      admission.remarks =
        remarks ||
        'Application approved';


      // ⭐ Save Admin selected batch
      admission.batch =
        selectedBatch._id;


      await admission.save();


      // ===================================================
      // RESPONSE
      // =====================================================

      return res.status(200).json({

        success: true,

        message:
          'Admission approved successfully. Student account created.',

        data: {

          admission,

          student: {

            studentId:
              student.studentId,

            name:
              student.name,

            defaultPassword:
              'Phone number (ask student to change)',

            batch: {

              id:
                selectedBatch._id,

              name:
                selectedBatch.name,

              time:
                selectedBatch.time,

              days:
                selectedBatch.days,

              status:
                selectedBatch.status,

              teacher:
                selectedBatch.teacher?.name ||
                '',
            },

          },

        },

      });

    }


    // =====================================================
    // REJECT
    // =====================================================

    if (status === 'rejected') {

      admission.status =
        'rejected';


      admission.reviewedBy =
        req.user.id;


      admission.reviewedAt =
        new Date();


      admission.remarks =
        remarks ||
        'Application rejected';


      await admission.save();


      return res.status(200).json({

        success: true,

        message:
          'Admission application rejected.',

        data: {

          admission,
        },

      });

    }


    // =====================================================
    // GENERAL UPDATE
    // =====================================================

    if (
      remarks !== undefined
    ) {

      admission.remarks =
        remarks;

    }


    // -----------------------------------------------------
    // Update Batch While Pending
    // -----------------------------------------------------

    if (batch) {

      if (
        admission.status !== 'pending'
      ) {

        return next(
          new AppError(
            'Change the student batch from the Students module after an admission is processed.',
            400
          )
        );

      }


      // Validate selected batch
      await getValidBatchForCourse(
        batch,
        admission.course._id
      );


      admission.batch =
        batch;

    }


    await admission.save();


    return res.status(200).json({

      success: true,

      message:
        'Admission updated successfully.',

      data: {

        admission,
      },

    });

  }
);


// =========================================================
// ADMIN: DELETE ADMISSION
// =========================================================

exports.deleteAdmission = catchAsync(
  async (req, res, next) => {

    const admission =
      await Admission.findByIdAndDelete(
        req.params.id
      );


    if (!admission) {

      return next(
        new AppError(
          'Admission application not found.',
          404
        )
      );

    }


    return res.status(200).json({

      success: true,

      message:
        'Admission application deleted successfully.',

    });

  }
);