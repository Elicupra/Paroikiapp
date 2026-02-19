const jwt = require('jsonwebtoken');
const pool = require('../models/db');

// Middleware para verificar JWT
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'NO_TOKEN',
          message: 'No authorization token provided',
        },
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar que el usuario siga siendo activo
    const result = await pool.query(
      'SELECT id, email, rol, nombre_mostrado, activo FROM usuarios WHERE id = $1',
      [decoded.userId]
    );

    if (!result.rows.length || !result.rows[0].activo) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'User not found or inactive',
        },
      });
    }

    req.user = {
      userId: decoded.userId,
      email: result.rows[0].email,
      rol: result.rows[0].rol,
      nombre: result.rows[0].nombre_mostrado,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token',
        },
      });
    }
    res.status(500).json({
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication error',
      },
    });
  }
};

// Middleware para verificar rol
const requireRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'NO_AUTH',
        message: 'Authentication required',
      },
    });
  }

  if (!roles.includes(req.user.rol)) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      },
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  requireRole,
};
