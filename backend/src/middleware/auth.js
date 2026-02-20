const jwt = require('jsonwebtoken');
const pool = require('../models/db');

const isAdminRole = (role) => role === 'organizador' || role === 'administrador';

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

// Middleware para permitir monitor o simulacion de monitor por organizador
const requireMonitorOrSimulated = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'NO_AUTH',
        message: 'Authentication required',
      },
    });
  }

  if (req.user.rol === 'monitor') {
    return next();
  }

  if (!isAdminRole(req.user.rol)) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      },
    });
  }

  const simulateUserId = req.headers['x-simulate-user'];
  if (!simulateUserId) {
    return res.status(403).json({
      error: {
        code: 'SIMULATION_REQUIRED',
        message: 'Simulation user id required for organizer access',
      },
    });
  }

  try {
    const result = await pool.query(
      'SELECT id, rol, activo, nombre_mostrado FROM usuarios WHERE id = $1',
      [simulateUserId]
    );

    if (!result.rows.length || !result.rows[0].activo || result.rows[0].rol !== 'monitor') {
      return res.status(400).json({
        error: {
          code: 'INVALID_SIMULATION_USER',
          message: 'Simulation user must be an active monitor',
        },
      });
    }

    req.user.simulatedUserId = result.rows[0].id;
    req.user.simulatedNombre = result.rows[0].nombre_mostrado;
    return next();
  } catch (err) {
    return res.status(500).json({
      error: {
        code: 'SIMULATION_ERROR',
        message: 'Error validating simulation user',
      },
    });
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  requireMonitorOrSimulated,
  isAdminRole,
};
