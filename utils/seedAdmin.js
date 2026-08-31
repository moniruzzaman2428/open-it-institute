/**
 * Seed Admin User
 * Run: npm run seed  (from server folder)
 * or:  node utils/seedAdmin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@openitinstitute.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';
    const adminPhone = process.env.ADMIN_PHONE || '01700000000';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('⚠️  Admin already exists with email:', adminEmail);
      console.log('   Role:', existingAdmin.role);
      process.exit(0);
    }

    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      phone: adminPhone,
      password: adminPassword,
      role: 'admin',
      status: 'active'
    });

    console.log('✅ Admin created successfully!');
    console.log('--------------------------------');
    console.log('Name    :', admin.name);
    console.log('Email   :', admin.email);
    console.log('Phone   :', admin.phone);
    console.log('Role    :', admin.role);
    console.log('--------------------------------');
    console.log('⚠️  Please change the default password after first login.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();
