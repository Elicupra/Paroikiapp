const jwt = require('jsonwebtoken');
const pool = require('../models/db');
const { hashPassword, comparePassword, generateUUID, hashToken } = require('../utils/crypto');

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const result = await pool.query(
      'SELECT id, email, password_hash, rol, nombre_mostrado, activo FROM usuarios WHERE email = $1',
      [email]
    );

    if (!result.rows.length || !result.rows[0].activo) {
      // No revelar si el usuario existe o no
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const user = result.rows[0];

    // Verificar contraseña
    const passwordValid = await comparePassword(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Generar tokens
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = generateUUID();
    const refreshTokenHash = hashToken(refreshToken);
    const refreshTokenExpiration = new Date();
    refreshTokenExpiration.setDate(refreshTokenExpiration.getDate() + 7);

    // Guardar refresh token hash en BD
    await pool.query(
      'INSERT INTO refresh_tokens (usuario_id, refresh_token_hash, expira_en) VALUES ($1, $2, $3)',
      [user.id, refreshTokenHash, refreshTokenExpiration]
    );

    // Actualizar último login
    await pool.query(
      'UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre_mostrado: user.nombre_mostrado,
        rol: user.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Refresh token
const refreshTokenEndpoint = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token required',
        },
      });
    }

    const refreshTokenHash = hashToken(refreshToken);

    // Verificar que el refresh token existe y es válido
    const result = await pool.query(
      `SELECT usuario_id FROM refresh_tokens
       WHERE refresh_token_hash = $1 AND expira_en > NOW() AND activo = true`,
      [refreshTokenHash]
    );

    if (!result.rows.length) {
      return res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid or expired refresh token',
        },
      });
    }

    const userId = result.rows[0].usuario_id;

    // Generar nuevo access token
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const refreshTokenHash = hashToken(refreshToken);
      await pool.query(
        'UPDATE refresh_tokens SET activo = false WHERE refresh_token_hash = $1',
        [refreshTokenHash]
      );
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// Cambiar contraseña
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Obtener contraseña actual del usuario
    const result = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Verificar contraseña actual
    const passwordValid = await comparePassword(currentPassword, result.rows[0].password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
        },
      });
    }

    // Hashear nueva contraseña
    const newPasswordHash = await hashPassword(newPassword);

    // Actualizar contraseña
    await pool.query(
      'UPDATE usuarios SET password_hash = $1, actualizado_en = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Invalidar todos los refresh tokens
    await pool.query(
      'UPDATE refresh_tokens SET activo = false WHERE usuario_id = $1',
      [userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// Cambiar email
const changeEmail = async (req, res, next) => {
  try {
    const { password, newEmail } = req.body;
    const userId = req.user.userId;

    // Verificar contraseña
    const result = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const passwordValid = await comparePassword(password, result.rows[0].password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Password is incorrect',
        },
      });
    }

    // Validar formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format',
        },
      });
    }

    // Actualizar email
    await pool.query(
      'UPDATE usuarios SET email = $1, actualizado_en = NOW() WHERE id = $2',
      [newEmail, userId]
    );

    res.json({ message: 'Email changed successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already in use',
        },
      });
    }
    next(err);
  }
};

// PATCH /api/auth/me/profile
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const nombre_mostrado = String(req.body?.nombre_mostrado || '').trim();

    if (!nombre_mostrado || nombre_mostrado.length < 2 || nombre_mostrado.length > 100) {
      return res.status(400).json({
        error: {
          code: 'INVALID_NAME',
          message: 'nombre_mostrado must be 2-100 characters',
        },
      });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET nombre_mostrado = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING id, email, nombre_mostrado, rol`,
      [nombre_mostrado, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me/profile
const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, email, nombre_mostrado, rol,
              COALESCE(notificacion_email, email) as notificacion_email,
              COALESCE(notificacion_webhook, '') as notificacion_webhook,
              COALESCE(notificacion_email_habilitada, true) as notificacion_email_habilitada
       FROM usuarios
       WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me/notifications
const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id,
              COALESCE(notificacion_email, email) as notificacion_email,
              COALESCE(notificacion_webhook, '') as notificacion_webhook,
              COALESCE(notificacion_email_habilitada, true) as notificacion_email_habilitada
       FROM usuarios
       WHERE id = $1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/me/notifications
const updateMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const notificacion_email = String(req.body?.notificacion_email || '').trim();
    const notificacion_webhook = String(req.body?.notificacion_webhook || '').trim();
    const notificacion_email_habilitada = req.body?.notificacion_email_habilitada !== undefined
      ? Boolean(req.body.notificacion_email_habilitada)
      : true;

    if (notificacion_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificacion_email)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid notification email format',
        },
      });
    }

    if (notificacion_webhook && !/^https?:\/\//i.test(notificacion_webhook)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_WEBHOOK',
          message: 'Webhook must start with http:// or https://',
        },
      });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET notificacion_email = $1,
           notificacion_webhook = $2,
           notificacion_email_habilitada = $3,
           actualizado_en = NOW()
       WHERE id = $4
       RETURNING id,
                 COALESCE(notificacion_email, email) as notificacion_email,
                 COALESCE(notificacion_webhook, '') as notificacion_webhook,
                 COALESCE(notificacion_email_habilitada, true) as notificacion_email_habilitada`,
      [notificacion_email || null, notificacion_webhook || null, notificacion_email_habilitada, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({ message: 'Notification preferences updated', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  refreshTokenEndpoint,
  logout,
  changePassword,
  changeEmail,
  updateProfile,
  getMyProfile,
  getMyNotifications,
  updateMyNotifications,
};
