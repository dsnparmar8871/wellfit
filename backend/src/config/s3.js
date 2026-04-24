const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, GIF allowed.'), false);
  }
};

// S3 storage
const s3Storage = multerS3({
  s3,
  bucket: process.env.AWS_S3_BUCKET,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: (req, file, cb) => {
    const folder = req.uploadFolder || 'uploads';
    const filename = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

// Local disk storage fallback (for dev without S3)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});

const hasRealValue = (v) => {
  if (!v) return false;
  const value = String(v).trim().toLowerCase();
  if (!value) return false;
  if (value.includes('your_')) return false;
  if (value.includes('xxxxxxxx')) return false;
  return true;
};

const isS3Configured =
  hasRealValue(process.env.AWS_ACCESS_KEY_ID) &&
  hasRealValue(process.env.AWS_SECRET_ACCESS_KEY) &&
  hasRealValue(process.env.AWS_S3_BUCKET);

const upload = multer({
  storage: isS3Configured ? s3Storage : diskStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

const deleteFromS3 = async (key) => {
  if (!isS3Configured) return;
  await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: key }).promise();
};

module.exports = { upload, s3, deleteFromS3 };
