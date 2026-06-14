const multer = require('multer');

// Configure memory storage
const storage = multer.memoryStorage();

// Set file upload constraints (10MB maximum file size)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

module.exports = upload;
