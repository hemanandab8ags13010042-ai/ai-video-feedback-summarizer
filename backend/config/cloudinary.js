const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('✅ Cloudinary initialized for file storage.');
} else {
  console.log('ℹ️ Cloudinary credentials missing. Using local uploads directory.');
}

/**
 * Uploads a file either to Cloudinary or saves it locally.
 * @param {Object} file Multer file object
 * @returns {Promise<string>} File URL
 */
async function uploadFile(file) {
  if (!file) return null;

  if (isCloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      if (file.path) {
        // Disk storage file upload
        cloudinary.uploader.upload(
          file.path,
          { resource_type: 'auto', folder: 'ai_video_feedback' },
          (error, result) => {
            // Delete temporary file from disk
            try {
              if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
              }
            } catch (unlinkErr) {
              console.error('Failed to delete temporary upload file:', unlinkErr.message);
            }

            if (error) {
              console.error('Cloudinary Upload Error:', error);
              return reject(error);
            }
            resolve(result.secure_url);
          }
        );
      } else {
        // Memory storage buffer upload
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: 'auto', folder: 'ai_video_feedback' },
          (error, result) => {
            if (error) {
              console.error('Cloudinary Upload Error:', error);
              return reject(error);
            }
            resolve(result.secure_url);
          }
        );
        uploadStream.end(file.buffer);
      }
    });
  } else {
    // Local upload fallback
    if (file.path) {
      // Already saved to disk by multer diskStorage
      return `/uploads/${file.filename}`;
    } else {
      // Saved from buffer
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const ext = path.extname(file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const filename = `${Date.now()}-${hash}${ext}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      return `/uploads/${filename}`;
    }
  }
}

module.exports = {
  uploadFile,
  isCloudinaryConfigured
};
