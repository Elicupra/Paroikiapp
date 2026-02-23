const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomUUID } = require('crypto');

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
    cb(null, randomUUID());
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/octet-stream'];
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

const monitorStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const monitorFolder = `monitor-${req.user?.simulatedUserId || req.user?.userId || 'unknown'}`;
    const folder = path.join(uploadsBase, monitorFolder);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, randomUUID());
  },
});

const uploadMonitorFichero = multer({
  storage: monitorStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const validateRealFileType = async (req, res, next) => {
  try {
    if (!req.file?.path) {
      return next();
    }

    const allowedMimeTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
    ]);

    const { fileTypeFromFile } = await import('file-type');
    const detected = await fileTypeFromFile(req.file.path);

    let realMimeType = detected?.mime;
    if (!realMimeType) {
      const ext = path.extname(req.file.originalname || '').toLowerCase();
      if ((req.file.mimetype === 'text/plain' || req.file.mimetype === 'application/octet-stream') && ext === '.txt') {
        realMimeType = 'text/plain';
      }
    }

    if (!realMimeType || !allowedMimeTypes.has(realMimeType)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Formato no permitido. Solo PDF, JPEG, PNG, WEBP o TXT',
        },
      });
    }

    req.file.detectedMimeType = realMimeType;
    next();
  } catch (error) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    return res.status(400).json({
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'No se pudo validar el tipo de archivo',
      },
    });
  }
};

module.exports = {
  uploadsBase,
  uploadJovenDocumento,
  uploadMonitorFichero,
  validateRealFileType,
};
