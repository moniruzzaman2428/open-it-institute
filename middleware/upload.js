const multer = require('multer');


// Store files temporarily in memory
const storage = multer.memoryStorage();


// Only allow image files
const fileFilter = (req, file, cb) => {

  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(
      new Error('Only image files are allowed!'),
      false
    );
  }

};


const upload = multer({

  storage,

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024
  }

});


module.exports = upload;

