const mongoose = require('mongoose');

const websiteSettingsSchema = new mongoose.Schema(
  {
    instituteName: {
      type: String,
      default: 'OPEN IT INSTITUTE'
    },
    logo: {
      type: String,
      default: ''
    },
    favicon: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    email: {
      type: String,
      default: ''
    },
    address: {
      type: String,
      default: ''
    },
    facebookUrl: {
      type: String,
      default: ''
    },
    youtubeUrl: {
      type: String,
      default: ''
    },
    googleMap: {
      type: String,
      default: ''
    },
    heroHeadline: {
      type: String,
      default: 'ডিজিটাল দক্ষতায় গড়ে উঠুক আপনার ভবিষ্যৎ'
    },
    heroSubheadline: {
      type: String,
      default: 'আধুনিক প্রযুক্তি ও প্র্যাকটিক্যাল প্রশিক্ষণের মাধ্যমে দক্ষতা অর্জন করুন Open IT Institute-এর সাথে।'
    },
    aboutText: {
      type: String,
      default: ''
    },
    mission: {
      type: String,
      default: ''
    },
    vision: {
      type: String,
      default: ''
    },
    footerText: {
      type: String,
      default: ''
    },
    // Stats
    totalStudents: {
      type: Number,
      default: 0
    },
    totalCourses: {
      type: Number,
      default: 0
    },
    totalTeachers: {
      type: Number,
      default: 0
    },
    successfulStudents: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one settings document
websiteSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('WebsiteSettings', websiteSettingsSchema);
