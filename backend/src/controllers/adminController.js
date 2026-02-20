const pool = require('../models/db');
const { hashPassword, generateUUID } = require('../utils/crypto');

const normalizeRole = (role) => role === 'administrador' ? 'organizador' : role;

let hasTipoEventoColumnCache = null;

const getLegacyTipoFromNombre = (nombre = '') => {
  const normalized = String(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('campamento')) return 'campamento';
  if (normalized.includes('peregrin')) return 'peregrinacion';
  if (normalized.includes('viaje')) return 'viaje';
  return 'otro';
};

const hasTipoEventoColumn = async () => {
  if (hasTipoEventoColumnCache !== null) {
    return hasTipoEventoColumnCache;
  }

  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'eventos'
       AND column_name = 'tipo_evento_id'
     LIMIT 1`
  );

  hasTipoEventoColumnCache = result.rows.length > 0;
  return hasTipoEventoColumnCache;
};

// GET /api/admin/eventos
const getEventos = async (req, res, next) => {
  try {
    const { incluir_pasados } = req.query;
    const withTipoEvento = await hasTipoEventoColumn();

    let query = `SELECT e.id, e.nombre, e.tipo, e.descripcion, e.precio_base, e.fecha_inicio, e.fecha_fin,
                 e.localizacion, e.fotos, e.otra_informacion, e.activo, e.creado_en,
                 ${withTipoEvento ? 'e.tipo_evento_id,' : 'NULL::uuid as tipo_evento_id,'}
                 ${withTipoEvento ? 'te.nombre as tipo_evento_nombre,' : 'NULL::text as tipo_evento_nombre,'}
                 COALESCE(ec.descuento_global, 0) as descuento_global,
                 COUNT(DISTINCT j.id)::int as total_jovenes,
                 COUNT(DISTINCT m.id)::int as total_grupos,
                 COALESCE(SUM(CASE WHEN p.pagado = true THEN p.cantidad - COALESCE(p.descuento, 0) ELSE 0 END), 0) as total_pagado,
                 (COALESCE(e.precio_base, 0) * GREATEST(5, COUNT(DISTINCT m.id))) - (COALESCE(ec.descuento_global, 0) * GREATEST(5, COUNT(DISTINCT m.id))) as total_esperado
                 FROM eventos e
                 ${withTipoEvento ? 'LEFT JOIN tipos_evento te ON te.id = e.tipo_evento_id' : ''}
                 LEFT JOIN evento_config ec ON ec.evento_id = e.id
                 LEFT JOIN monitores m ON m.evento_id = e.id AND m.activo = true
                 LEFT JOIN jovenes j ON j.evento_id = e.id
                 LEFT JOIN pagos p ON p.joven_id = j.id`;
    
    if (incluir_pasados !== 'true') {
      query += ` WHERE e.activo = true`;
    }
    
    query += ` GROUP BY e.id, ec.descuento_global${withTipoEvento ? ', te.nombre' : ''} ORDER BY e.creado_en DESC`;
    
    const result = await pool.query(query);

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/eventos/:eventoId/descuento-global
const updateEventoDescuentoGlobal = async (req, res, next) => {
  try {
    const { eventoId } = req.params;
    const descuento_global = Number(req.body?.descuento_global || 0);

    if (!Number.isFinite(descuento_global) || descuento_global < 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DESCUENTO',
          message: 'descuento_global must be a non-negative number',
        },
      });
    }

    const exists = await pool.query('SELECT id FROM eventos WHERE id = $1', [eventoId]);
    if (!exists.rows.length) {
      return res.status(404).json({
        error: {
          code: 'EVENTO_NOT_FOUND',
          message: 'Evento not found',
        },
      });
    }

    const result = await pool.query(
      `INSERT INTO evento_config (evento_id, descuento_global, actualizado_en)
       VALUES ($1, $2, now())
       ON CONFLICT (evento_id)
       DO UPDATE SET descuento_global = $2, actualizado_en = now()
       RETURNING evento_id, descuento_global, actualizado_en`,
      [eventoId, descuento_global]
    );

    res.json({
      mensaje: 'Descuento global actualizado',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/tipos-evento
const getTiposEvento = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, activo
       FROM tipos_evento
       ORDER BY nombre ASC`
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/tipos-evento
const createTipoEvento = async (req, res, next) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();

    if (!nombre) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre is required',
        },
      });
    }

    const result = await pool.query(
      `INSERT INTO tipos_evento (nombre)
       VALUES ($1)
       RETURNING id, nombre, activo`,
      [nombre]
    );

    res.status(201).json({
      mensaje: 'Tipo de evento creado',
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: {
          code: 'TIPO_EVENTO_EXISTS',
          message: 'Tipo de evento already exists',
        },
      });
    }
    next(err);
  }
};

// PATCH /api/admin/tipos-evento/:tipoId
const updateTipoEvento = async (req, res, next) => {
  try {
    const { tipoId } = req.params;
    const updates = [];
    const values = [];

    if (req.body?.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) {
        return res.status(400).json({
          error: {
            code: 'INVALID_NAME',
            message: 'nombre cannot be empty',
          },
        });
      }
      values.push(nombre);
      updates.push(`nombre = $${values.length}`);
    }

    if (req.body?.activo !== undefined) {
      values.push(Boolean(req.body.activo));
      updates.push(`activo = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_UPDATES',
          message: 'No fields to update',
        },
      });
    }

    values.push(tipoId);
    const result = await pool.query(
      `UPDATE tipos_evento
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, nombre, activo`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'TIPO_EVENTO_NOT_FOUND',
          message: 'Tipo de evento not found',
        },
      });
    }

    res.json({
      mensaje: 'Tipo de evento actualizado',
      data: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: {
          code: 'TIPO_EVENTO_EXISTS',
          message: 'Tipo de evento already exists',
        },
      });
    }
    next(err);
  }
};

// DELETE /api/admin/tipos-evento/:tipoId
const deleteTipoEvento = async (req, res, next) => {
  try {
    const { tipoId } = req.params;

    const result = await pool.query(
      `DELETE FROM tipos_evento
       WHERE id = $1
       RETURNING id, nombre`,
      [tipoId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'TIPO_EVENTO_NOT_FOUND',
          message: 'Tipo de evento not found',
        },
      });
    }

    res.json({
      mensaje: 'Tipo de evento eliminado',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/usuarios/:usuarioId/jovenes
const getUsuarioJovenes = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;

    const result = await pool.query(
      `SELECT j.id, j.nombre, j.apellidos, j.evento_id, e.nombre as evento_nombre, j.creado_en
       FROM jovenes j
       JOIN monitores m ON m.id = j.monitor_id
       JOIN eventos e ON e.id = j.evento_id
       WHERE m.usuario_id = $1
       ORDER BY j.creado_en DESC`,
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

// POST /api/admin/eventos
const createEvento = async (req, res, next) => {
  try {
    const { nombre, tipo, tipo_evento_id, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos, otra_informacion } = req.body;
    const withTipoEvento = await hasTipoEventoColumn();

    let finalTipo = tipo;
    let finalTipoEventoId = null;

    if (withTipoEvento && tipo_evento_id) {
      const tipoResult = await pool.query(
        `SELECT id, nombre FROM tipos_evento WHERE id = $1`,
        [tipo_evento_id]
      );

      if (!tipoResult.rows.length) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TIPO_EVENTO',
            message: 'tipo_evento_id is invalid',
          },
        });
      }

      finalTipoEventoId = tipoResult.rows[0].id;
      if (!finalTipo) {
        finalTipo = getLegacyTipoFromNombre(tipoResult.rows[0].nombre);
      }
    }

    if (!nombre || !finalTipo) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre and tipo are required',
        },
      });
    }

    const result = withTipoEvento
      ? await pool.query(
        `INSERT INTO eventos (nombre, tipo, tipo_evento_id, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos, otra_informacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [nombre, finalTipo, finalTipoEventoId, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos || [], otra_informacion]
      )
      : await pool.query(
        `INSERT INTO eventos (nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos, otra_informacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [nombre, finalTipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos || [], otra_informacion]
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
    const withTipoEvento = await hasTipoEventoColumn();

    const result = await pool.query(
      `SELECT e.*,
              ${withTipoEvento ? 'te.nombre as tipo_evento_nombre' : 'NULL::text as tipo_evento_nombre'}
       FROM eventos e
       ${withTipoEvento ? 'LEFT JOIN tipos_evento te ON te.id = e.tipo_evento_id' : ''}
       WHERE e.id = $1`,
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
    const { nombre, tipo, tipo_evento_id, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos, otra_informacion, activo } = req.body;
    const withTipoEvento = await hasTipoEventoColumn();

    let finalTipo = tipo;
    let finalTipoEventoId = null;

    if (withTipoEvento && tipo_evento_id) {
      const tipoResult = await pool.query(
        `SELECT id, nombre FROM tipos_evento WHERE id = $1`,
        [tipo_evento_id]
      );

      if (!tipoResult.rows.length) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TIPO_EVENTO',
            message: 'tipo_evento_id is invalid',
          },
        });
      }

      finalTipoEventoId = tipoResult.rows[0].id;
      if (!finalTipo) {
        finalTipo = getLegacyTipoFromNombre(tipoResult.rows[0].nombre);
      }
    }

    if (!nombre || !finalTipo) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre and tipo are required',
        },
      });
    }

    const result = withTipoEvento
      ? await pool.query(
        `UPDATE eventos 
         SET nombre = $1, tipo = $2, tipo_evento_id = $3, descripcion = $4, precio_base = $5, 
             fecha_inicio = $6, fecha_fin = $7, localizacion = $8, fotos = $9, 
             otra_informacion = $10, activo = $11, actualizado_en = now()
         WHERE id = $12
         RETURNING *`,
        [nombre, finalTipo, finalTipoEventoId, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos || [], otra_informacion, activo, eventoId]
      )
      : await pool.query(
        `UPDATE eventos 
         SET nombre = $1, tipo = $2, descripcion = $3, precio_base = $4, 
             fecha_inicio = $5, fecha_fin = $6, localizacion = $7, fotos = $8, 
             otra_informacion = $9, activo = $10, actualizado_en = now()
         WHERE id = $11
         RETURNING *`,
        [nombre, finalTipo, descripcion, precio_base, fecha_inicio, fecha_fin, localizacion, fotos || [], otra_informacion, activo, eventoId]
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
      `SELECT u.id, u.email, u.nombre_mostrado, u.rol, u.activo, u.ultimo_login, u.creado_en,
              COALESCE((
                SELECT COUNT(*)
                FROM jovenes j
                JOIN monitores m ON m.id = j.monitor_id
                WHERE m.usuario_id = u.id
              ), 0)::int as jovenes_count
       FROM usuarios u
       ORDER BY u.creado_en DESC`
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

    const normalizedRole = normalizeRole(rol);
    const rolValido = ['monitor', 'organizador'].includes(normalizedRole);
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
      [email, passwordHash, nombre_mostrado, normalizedRole]
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

    const normalizedRole = normalizeRole(rol);
    const rolValido = ['monitor', 'organizador'].includes(normalizedRole);
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
      [email, nombre_mostrado, normalizedRole, activo !== undefined ? activo : true, usuarioId]
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
  getTiposEvento,
  createTipoEvento,
  updateTipoEvento,
  deleteTipoEvento,
  getEventos,
  createEvento,
  getEvento,
  updateEvento,
  deleteEvento,
  updateEventoDescuentoGlobal,
  getEventoJovenes,
  getUsuarios,
  createUsuario,
  getUsuario,
  updateUsuario,
  deleteUsuario,
  getUsuarioJovenes,
  toggleUsuarioActivo,
  getUsuarioEventos,
  assignMonitorEvento,
  removeMonitorEvento,
  revokeMonitorToken,
  getRegistrationLinks,
  getJovenes,
};
