// Middleware de manejo de errores
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  // Errores esperados
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code || 'ERROR',
        message: err.message,
      },
    });
  }

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'This entry already exists',
      },
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(409).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist',
      },
    });
  }

  // Generic error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    },
  });
};

// Middleware para loguear requests
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

module.exports = {
  errorHandler,
  requestLogger,
};
