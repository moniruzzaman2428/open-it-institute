const cloudinary = require('../config/cloudinary');

const uploadToCloudinary = (
  buffer,
  folder = 'open-it-institute/gallery'
) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(buffer);
  });
};

module.exports = uploadToCloudinary;