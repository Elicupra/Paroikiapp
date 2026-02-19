const pool = require('../models/db');
const { hashPassword, generateUUID } = require('../utils/crypto');

// GET /api/admin/eventos
const getEventos = async (req, res, next) => {
  try {
    const { incluir_pasados } = req.query;
    let query = `SELECT id, nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, 
                 localizacion, fotos, otra_informacion, activo, creado_en 
                 FROM eventos`;
    
    if (incluir_pasados !== 'true') {
      query += ` WHERE activo = true`;
    }
    
    query += ` ORDER BY creado_en DESC`;
    
    const result = await pool.query(query);

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
    const { nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos, otra_informacion } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre and tipo are required',
        },
      });
    }

    const result = await pool.query(
      `INSERT INTO eventos (nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos, otra_informacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos || [], otra_informacion]
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

// GET /api/admin/eventos/:eventoId
const getEvento = async (req, res, next) => {
  try {
    const { eventoId } = req.params;

    const result = await pool.query(
      `SELECT * FROM eventos WHERE id = $1`,
      [eventoId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'EVENTO_NOT_FOUND',
          message: 'Evento not found',
        },
      });
    }

    res.json({
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/eventos/:eventoId
const updateEvento = async (req, res, next) => {
  try {
    const { eventoId } = req.params;
    const { nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos, otra_informacion, activo } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre and tipo are required',
        },
      });
    }

    const result = await pool.query(
      `UPDATE eventos 
       SET nombre = $1, tipo = $2, descripcion = $3, precio_base = $4, 
           fecha_inicio = $5, fecha_fin = $6, localizacion = $7, fotos = $8, 
           otra_informacion = $9, activo = $10, actualizado_en = now()
       WHERE id = $11
       RETURNING *`,
      [nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos || [], otra_informacion, activo, eventoId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'EVENTO_NOT_FOUND',
          message: 'Evento not found',
        },
      });
    }

    res.json({
      mensaje: 'Evento actualizado exitosamente',
      evento: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/eventos/:eventoId
const deleteEvento = async (req, res, next) => {
  try {
    const { eventoId } = req.params;

    // Soft delete - marcar como inactivo en lugar de borrar
    const result = await pool.query(
      `UPDATE eventos SET activo = false, actualizado_en = now() WHERE id = $1 RETURNING id, nombre`,
      [eventoId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'EVENTO_NOT_FOUND',
          message: 'Evento not found',
        },
      });
    }

    res.json({
      mensaje: 'Evento desactivado exitosamente',
      evento: result.rows[0],
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

// GET /api/admin/registration-links - Obtener enlaces de registro de todos los monitores
const getRegistrationLinks = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.enlace_token, m.evento_id, m.usuario_id, e.nombre as evento_nombre,
              u.email, u.nombre_mostrado
       FROM monitores m
       JOIN eventos e ON m.evento_id = e.id
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE m.activo = true
       ORDER BY e.nombre, u.nombre_mostrado`
    );

    const links = result.rows.map(monitor => ({
      id: monitor.id,
      token: monitor.enlace_token,
      evento_id: monitor.evento_id,
      evento_nombre: monitor.evento_nombre,
      monitor_email: monitor.email,
      monitor_nombre: monitor.nombre_mostrado,
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/register?token=${monitor.enlace_token}`,
    }));

    res.json({
      data: links,
      total: links.length,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/jovenes - Obtener todos los jóvenes
const getJovenes = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT j.id, j.nombre, j.apellidos, j.evento_id, e.nombre as evento_nombre,
              m.usuario_id, u.nombre_mostrado as monitor_nombre,
              (SELECT COUNT(*) FROM documentos WHERE joven_id = j.id) as documentos_count,
              (SELECT COUNT(*) FROM pagos WHERE joven_id = j.id) as pagos_count
       FROM jovenes j
       JOIN eventos e ON j.evento_id = e.id
       JOIN monitores m ON j.monitor_id = m.id
       JOIN usuarios u ON m.usuario_id = u.id
       ORDER BY e.nombre, j.creado_en DESC`
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/usuarios/:usuarioId
const getUsuario = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;

    const result = await pool.query(
      'SELECT id, email, nombre_mostrado, rol, activo, ultimo_login, creado_en FROM usuarios WHERE id = $1',
      [usuarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USUARIO_NOT_FOUND',
          message: 'Usuario not found',
        },
      });
    }

    res.json({
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/usuarios/:usuarioId
const updateUsuario = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    const { email, nombre_mostrado, rol, activo } = req.body;

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

    const result = await pool.query(
      `UPDATE usuarios 
       SET email = $1, nombre_mostrado = $2, rol = $3, activo = $4
       WHERE id = $5
       RETURNING id, email, nombre_mostrado, rol, activo, creado_en`,
      [email, nombre_mostrado, rol, activo !== undefined ? activo : true, usuarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USUARIO_NOT_FOUND',
          message: 'Usuario not found',
        },
      });
    }

    res.json({
      mensaje: 'Usuario actualizado exitosamente',
      usuario: result.rows[0],
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

// PATCH /api/admin/usuarios/:usuarioId/toggle-active
const toggleUsuarioActivo = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;

    const result = await pool.query(
      `UPDATE usuarios 
       SET activo = NOT activo
       WHERE id = $1
       RETURNING id, email, nombre_mostrado, activo`,
      [usuarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USUARIO_NOT_FOUND',
          message: 'Usuario not found',
        },
      });
    }

    res.json({
      mensaje: 'Estado de usuario actualizado',
      usuario: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/usuarios/:usuarioId/eventos - Obtener eventos asignados a un monitor
const getUsuarioEventos = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;

    const result = await pool.query(
      `SELECT m.id as monitor_id, m.evento_id, e.nombre as evento_nombre, 
              e.tipo, e.fecha_inicio, e.fecha_fin, m.activo, m.enlace_token
       FROM monitores m
       JOIN eventos e ON m.evento_id = e.id
       WHERE m.usuario_id = $1
       ORDER BY e.fecha_inicio DESC NULLS LAST`,
      [usuarioId]
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/monitores - Asignar monitor a evento
const assignMonitorEvento = async (req, res, next) => {
  try {
    const { usuario_id, evento_id } = req.body;

    if (!usuario_id || !evento_id) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'usuario_id and evento_id are required',
        },
      });
    }

    // Verificar que el usuario es monitor
    const userCheck = await pool.query(
      'SELECT rol FROM usuarios WHERE id = $1',
      [usuario_id]
    );

    if (!userCheck.rows.length || userCheck.rows[0].rol !== 'monitor') {
      return res.status(400).json({
        error: {
          code: 'INVALID_USER',
          message: 'User must be a monitor',
        },
      });
    }

    const result = await pool.query(
      `INSERT INTO monitores (usuario_id, evento_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, evento_id) DO NOTHING
       RETURNING id, usuario_id, evento_id, enlace_token`,
      [usuario_id, evento_id]
    );

    if (!result.rows.length) {
      return res.status(409).json({
        error: {
          code: 'ALREADY_ASSIGNED',
          message: 'Monitor already assigned to this event',
        },
      });
    }

    res.status(201).json({
      mensaje: 'Monitor asignado exitosamente',
      monitor: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/monitores/:monitorId - Eliminar asignación
const removeMonitorEvento = async (req, res, next) => {
  try {
    const { monitorId } = req.params;

    const result = await pool.query(
      'DELETE FROM monitores WHERE id = $1 RETURNING id, usuario_id, evento_id',
      [monitorId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: 'Monitor assignment not found',
        },
      });
    }

    res.json({
      mensaje: 'Asignación eliminada exitosamente',
      monitor: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/usuarios/:usuarioId
const deleteUsuario = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    const requesterId = req.user.userId;

    if (usuarioId === requesterId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_OPERATION',
          message: 'No puedes eliminar tu propio usuario',
        },
      });
    }

    const result = await pool.query(
      `DELETE FROM usuarios WHERE id = $1
       RETURNING id, email, nombre_mostrado, rol`,
      [usuarioId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'USUARIO_NOT_FOUND',
          message: 'Usuario not found',
        },
      });
    }

    res.json({
      mensaje: 'Usuario eliminado exitosamente',
      usuario: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEventos,
  createEvento,
  getEvento,
  updateEvento,
  deleteEvento,
  getEventoJovenes,
  getUsuarios,
  createUsuario,
  getUsuario,
  updateUsuario,
  deleteUsuario,
  toggleUsuarioActivo,
  getUsuarioEventos,
  assignMonitorEvento,
  removeMonitorEvento,
  revokeMonitorToken,
  getRegistrationLinks,
  getJovenes,
};
