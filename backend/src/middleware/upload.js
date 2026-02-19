const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadsBase = process.env.UPLOADS_PATH || path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadsBase)) {
  fs.mkdirSync(uploadsBase, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const jovenId = req.params.jovenId || req.body.joven_id || 'general';
    const folder = path.join(uploadsBase, jovenId);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Formato no permitido. Solo PDF o imagen'), false);
  }
  cb(null, true);
};

const uploadJovenDocumento = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = {
  uploadsBase,
  uploadJovenDocumento,
};
