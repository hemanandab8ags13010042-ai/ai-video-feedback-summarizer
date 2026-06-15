const multer = require('multer');

// Configure memory storage
const storage = multer.memoryStorage();

// Set file upload constraints (250MB maximum file size for videos)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 250 * 1024 * 1024 // 250MB limit
  }
});

module.exports = upload;
