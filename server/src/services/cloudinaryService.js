// Cloudinary Service — screenshot storage for malpractice proof
// Uses Cloudinary free tier (Section 5)
// Configured via CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET env vars
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a violation screenshot to Cloudinary.
 * Stored under: malpractice/{testId}/{candidateId}/{timestamp}.jpg (Section 15)
 *
 * @param {Buffer} imageBuffer - Image data
 * @param {string} testId
 * @param {string} candidateId
 * @returns {string} Cloudinary URL
 */
const uploadScreenshot = (imageBuffer, testId, candidateId) => {
  return new Promise((resolve, reject) => {
    // If Cloudinary credentials are provided, upload to Cloudinary CDN
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const timestamp = Date.now();
      const folder = `malpractice/${testId}/${candidateId}`;
      const public_id = `${folder}/${timestamp}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id,
          folder: undefined,
          overwrite: false,
          quality: 'auto',
          format: 'jpg',
        },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary] Upload error, falling back to data URL:', error.message);
            // Fallback to data URL so evidence is never lost
            const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
            resolve(dataUrl);
          } else {
            resolve(result.secure_url);
          }
        }
      );

      uploadStream.end(imageBuffer);
    } else {
      // In local dev/testing without Cloudinary credentials, store image as data URL (Base64 JPEG)
      // so proof screenshots are ALWAYS preserved and rendered in the admin dashboard!
      const dataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
      resolve(dataUrl);
    }
  });
};

/**
 * Delete a screenshot from Cloudinary.
 * Logged with admin ID + timestamp for audit trail (Section 13 Data Privacy).
 *
 * @param {string} publicIdOrUrl - Cloudinary public ID or URL
 * @param {string} adminId - Admin who authorized deletion
 * @returns {Object} Cloudinary delete result
 */
const deleteScreenshot = async (publicIdOrUrl, adminId) => {
  // Extract public_id from URL if full URL provided
  let publicId = publicIdOrUrl;
  if (publicIdOrUrl.includes('cloudinary.com')) {
    // Extract public_id from Cloudinary URL
    const parts = publicIdOrUrl.split('/upload/');
    if (parts.length > 1) {
      publicId = parts[1].replace(/\.[^.]+$/, ''); // remove file extension
    }
  }

  console.log(`[Cloudinary] Delete requested by admin=${adminId}: ${publicId}`);
  const result = await cloudinary.uploader.destroy(publicId);
  return result;
};

module.exports = { uploadScreenshot, deleteScreenshot };
