/**
 * Seed default courses
 * Run: node utils/seedCourses.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Course = require('../models/Course');
const { generateSlug } = require('./generateId');

const courses = [
  {
    title: 'Basic Computer & Office Application',
    description: 'MS Office, Internet, Email and basic computer skills for beginners.',
    duration: '3 Months',
    classHours: '2 hours/day',
    fee: 6000,
    discount: 10,
    instructor: 'Senior Instructor',
    curriculum: ['Computer Fundamentals', 'Windows OS', 'MS Word', 'MS Excel', 'MS PowerPoint', 'Internet & Email'],
    requirements: ['No prior experience needed'],
    benefits: ['Official Certificate', 'Practical Projects'],
    status: 'active'
  },
  {
    title: 'Graphic Design',
    description: 'Professional graphic design with Adobe Photoshop, Illustrator and InDesign.',
    duration: '4 Months',
    classHours: '2 hours/day',
    fee: 12000,
    discount: 15,
    instructor: 'Creative Director',
    curriculum: ['Design Principles', 'Photoshop', 'Illustrator', 'InDesign', 'Logo Design', 'Social Media Graphics'],
    requirements: ['Basic computer knowledge'],
    benefits: ['Portfolio Projects', 'Freelance Ready'],
    status: 'active'
  },
  {
    title: 'Web Design',
    description: 'HTML, CSS, Bootstrap, responsive design and UI/UX basics.',
    duration: '4 Months',
    classHours: '2 hours/day',
    fee: 12000,
    discount: 10,
    instructor: 'Senior Web Designer',
    curriculum: ['HTML5', 'CSS3', 'Bootstrap', 'Responsive Design', 'UI/UX Basics', 'Figma'],
    requirements: ['Basic computer knowledge'],
    benefits: ['Project Portfolio', 'Certificate'],
    status: 'active'
  },
  {
    title: 'Web Development',
    description: 'Full-stack web development with modern technologies including React and Node.js.',
    duration: '6 Months',
    classHours: '2.5 hours/day',
    fee: 18000,
    discount: 15,
    instructor: 'Senior Web Developer',
    curriculum: ['HTML5 & CSS3', 'JavaScript ES6+', 'React.js', 'Node.js & Express', 'MongoDB', 'REST APIs', 'Deployment'],
    requirements: ['Basic computer skills', 'Logical thinking'],
    benefits: ['Full Project Portfolio', 'Job Support', 'Industry Certificate'],
    status: 'active'
  },
  {
    title: 'Hardware & Networking',
    description: 'PC hardware, networking, troubleshooting and maintenance.',
    duration: '4 Months',
    classHours: '2 hours/day',
    fee: 12000,
    discount: 0,
    instructor: 'Hardware Specialist',
    curriculum: ['PC Assembly', 'Hardware Troubleshooting', 'Networking Basics', 'Router Configuration', 'Cable Management'],
    requirements: ['Interest in hardware'],
    benefits: ['Hands-on Lab', 'Certificate'],
    status: 'active'
  },
  {
    title: 'Freelancing',
    description: 'Marketplace strategies, client handling and earning online.',
    duration: '2 Months',
    classHours: '2 hours/day',
    fee: 8000,
    discount: 20,
    instructor: 'Freelance Expert',
    curriculum: ['Freelance Platforms', 'Profile Optimization', 'Client Communication', 'Proposal Writing', 'Payment Methods'],
    requirements: ['Any skill to sell'],
    benefits: ['Real Client Guidance', 'Certificate'],
    status: 'active'
  },
  {
    title: 'Digital Marketing',
    description: 'SEO, Social Media Marketing, Google Ads and content marketing.',
    duration: '3 Months',
    classHours: '2 hours/day',
    fee: 10000,
    discount: 10,
    instructor: 'Digital Marketing Expert',
    curriculum: ['SEO', 'Social Media Marketing', 'Google Ads', 'Content Marketing', 'Email Marketing', 'Analytics'],
    requirements: ['Basic computer knowledge'],
    benefits: ['Campaign Projects', 'Certificate'],
    status: 'active'
  },
  {
    title: 'Programming',
    description: 'Programming fundamentals with popular languages.',
    duration: '5 Months',
    classHours: '2 hours/day',
    fee: 15000,
    discount: 10,
    instructor: 'Programming Instructor',
    curriculum: ['Programming Logic', 'C/C++', 'Python Basics', 'Data Structures', 'Problem Solving'],
    requirements: ['Logical thinking'],
    benefits: ['Coding Practice', 'Certificate'],
    status: 'active'
  },
  {
    title: 'AI & Digital Skills',
    description: 'AI tools, ChatGPT, automation and future digital skills.',
    duration: '3 Months',
    classHours: '2 hours/day',
    fee: 12000,
    discount: 15,
    instructor: 'AI Specialist',
    curriculum: ['AI Fundamentals', 'ChatGPT Mastery', 'AI Image Tools', 'Automation', 'Future Skills'],
    requirements: ['Basic computer knowledge'],
    benefits: ['Hands-on AI Projects', 'Certificate'],
    status: 'active'
  }
];

const seedCourses = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    for (const course of courses) {
      const slug = generateSlug(course.title);
      const existing = await Course.findOne({ slug });

      if (existing) {
        console.log(`⚠️  Course already exists: ${course.title}`);
        continue;
      }

      await Course.create({ ...course, slug });
      console.log(`✅ Created: ${course.title}`);
    }

    console.log('\n✅ Course seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

seedCourses();
