const mongoose = require('mongoose');

let cached = global.mongooseCache;
if (!cached) cached = global.mongooseCache = { conn: null, promise: null };

const connectDB = async () => {
  if (cached.conn) return cached.conn;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000
      })
      .then((m) => {
        console.log(`✅ MongoDB Connected: ${m.connection.host}`);
        return m;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error(`❌ MongoDB connection error: ${err.message}`);
    throw err;
  }
  return cached.conn;
};

module.exports = connectDB;