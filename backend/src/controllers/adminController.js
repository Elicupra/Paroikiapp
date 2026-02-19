const pool = require('../models/db');
const { hashPassword, generateUUID } = require('../utils/crypto');

// GET /api/admin/eventos
const getEventos = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, tipo, precio_base, fecha_inicio, fecha_fin, activo, creado_en FROM eventos ORDER BY creado_en DESC'
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/eventos
const createEvento = async (req, res, next) => {
  try {
    const { nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre and tipo are required',
        },
      });
    }

    const result = await pool.query(
      `INSERT INTO eventos (nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, tipo, precio_base, fecha_inicio, fecha_fin, creado_en`,
      [nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin]
    );

    const evento = result.rows[0];

    res.status(201).json({
      mensaje: 'Evento creado exitosamente',
      evento,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/eventos/:eventoId/jovenes
const getEventoJovenes = async (req, res, next) => {
  try {
    const { eventoId } = req.params;

    const result = await pool.query(
      `SELECT j.id, j.nombre, j.apellidos, m.usuario_id, u.nombre_mostrado as monitor_nombre
       FROM jovenes j
       JOIN monitores m ON j.monitor_id = m.id
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE j.evento_id = $1
       ORDER BY j.creado_en DESC`,
      [eventoId]
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/usuarios
const getUsuarios = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, email, nombre_mostrado, rol, activo, ultimo_login, creado_en FROM usuarios ORDER BY creado_en DESC'
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/usuarios - Crear nuevo usuario
const createUsuario = async (req, res, next) => {
  try {
    const { email, nombre_mostrado, rol, password_temporal } = req.body;

    if (!email || !nombre_mostrado || !rol) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'email, nombre_mostrado, and rol are required',
        },
      });
    }

    const rolValido = ['monitor', 'organizador'].includes(rol);
    if (!rolValido) {
      return res.status(400).json({
        error: {
          code: 'INVALID_ROLE',
          message: 'Invalid role',
        },
      });
    }

    // Hashear contraseña temporal (o generar una si no se proporciona)
    const password = password_temporal || generateUUID().substring(0, 12);
    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre_mostrado, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, nombre_mostrado, rol, creado_en`,
      [email, passwordHash, nombre_mostrado, rol]
    );

    const usuario = result.rows[0];

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario,
      password_temporal: password, // Solo se devuelve una vez
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already exists',
        },
      });
    }
    next(err);
  }
};

// DELETE /api/admin/monitores/:monitorId/token - Revocar y regenerar enlace
const revokeMonitorToken = async (req, res, next) => {
  try {
    const { monitorId } = req.params;

    const newToken = generateUUID();

    const result = await pool.query(
      `UPDATE monitores SET enlace_token = $1 WHERE id = $2
       RETURNING id, enlace_token`,
      [newToken, monitorId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: 'Monitor not found',
        },
      });
    }

    res.json({
      mensaje: 'Token revocado y regenerado',
      monitor: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEventos,
  createEvento,
  getEventoJovenes,
  getUsuarios,
  createUsuario,
  revokeMonitorToken,
};
