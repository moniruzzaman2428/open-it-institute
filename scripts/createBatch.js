// scripts/createBatch.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Course = require('../models/Course');
const Teacher = require('../models/Teacher');
const Batch = require('../models/Batch');

const createDefaultBatch = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a course
    const course = await Course.findOne();
    if (!course) {
      console.log('❌ No course found. Please create a course first.');
      process.exit(1);
    }

    // Find a teacher
    const teacher = await Teacher.findOne();
    if (!teacher) {
      console.log('❌ No teacher found. Please create a teacher first.');
      process.exit(1);
    }

    // Check if batch already exists
    const existingBatch = await Batch.findOne({ course: course._id });
    if (existingBatch) {
      console.log('✅ Batch already exists:', existingBatch.name);
      process.exit(0);
    }

    // Create batch
    const batch = await Batch.create({
      name: `${course.title} - Batch 1`,
      course: course._id,
      teacher: teacher._id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days later
      days: ['Saturday', 'Monday', 'Wednesday'],
      time: '10:00 AM - 12:00 PM',
      room: 'Room 101',
      maximumStudents: 30,
      currentStudents: 0,
      status: 'upcoming'
    });

    console.log('✅ Batch created successfully:', batch.name);
    console.log('   Course:', course.title);
    console.log('   Teacher:', teacher.name);
    console.log('   Max Students:', batch.maximumStudents);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating batch:', error.message);
    process.exit(1);
  }
};

createDefaultBatch();