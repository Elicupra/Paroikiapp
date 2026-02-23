const pool = require('../models/db');
const { hashPassword, generateUUID } = require('../utils/crypto');

const normalizeRole = (role) => role === 'administrador' ? 'organizador' : role;

let hasTipoEventoColumnCache = null;
let hasAsignacionEventosTableCache = null;

const allowedConfigKeys = new Set([
  'app_nombre',
  'parroquia_nombre',
  'parroquia_texto',
  'parroquia_logo',
  'color_primario',
  'color_secundario',
  'color_acento',
  'contacto_email',
  'contacto_telefono',
  'contacto_direccion',
]);

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

const hasAsignacionEventosTable = async () => {
  if (hasAsignacionEventosTableCache !== null) {
    return hasAsignacionEventosTableCache;
  }

  const result = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = 'asignacion_eventos'
     LIMIT 1`
  );

  hasAsignacionEventosTableCache = result.rows.length > 0;
  return hasAsignacionEventosTableCache;
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

// GET /api/admin/eventos/:eventoId/recaudacion
const getEventoRecaudacionAdmin = async (req, res, next) => {
  try {
    const { eventoId } = req.params;
    const withAsignaciones = await hasAsignacionEventosTable();

    const eventoResult = await pool.query(
      `SELECT e.id, e.precio_base, COALESCE(ec.descuento_global, 0) as descuento_global
       FROM eventos e
       LEFT JOIN evento_config ec ON ec.evento_id = e.id
       WHERE e.id = $1`,
      [eventoId]
    );

    if (!eventoResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'EVENTO_NOT_FOUND',
          message: 'Evento not found',
        },
      });
    }

    const { precio_base, descuento_global } = eventoResult.rows[0];
    const precioEfectivo = Math.max(0, Number(precio_base || 0) - Number(descuento_global || 0));

    const porMonitor = await pool.query(
      withAsignaciones
        ? `SELECT m.id as monitor_id, u.nombre_mostrado,
                  COUNT(DISTINCT j.id)::int as total_jovenes,
                  COALESCE(SUM(CASE WHEN p.pagado = true THEN p.cantidad - COALESCE(p.descuento, 0) ELSE 0 END), 0) as recaudado
           FROM asignacion_eventos ae
           JOIN monitores m ON m.id = ae.monitor_id
           JOIN usuarios u ON u.id = m.usuario_id
           LEFT JOIN jovenes j ON j.monitor_id = m.id AND j.evento_id = ae.evento_id
           LEFT JOIN pagos p ON p.joven_id = j.id
           WHERE ae.evento_id = $1 AND ae.activo = true AND m.activo = true
           GROUP BY m.id, u.nombre_mostrado
           ORDER BY u.nombre_mostrado`
        : `SELECT m.id as monitor_id, u.nombre_mostrado,
                  COUNT(DISTINCT j.id)::int as total_jovenes,
                  COALESCE(SUM(CASE WHEN p.pagado = true THEN p.cantidad - COALESCE(p.descuento, 0) ELSE 0 END), 0) as recaudado
           FROM monitores m
           JOIN usuarios u ON u.id = m.usuario_id
           LEFT JOIN jovenes j ON j.monitor_id = m.id AND j.evento_id = m.evento_id
           LEFT JOIN pagos p ON p.joven_id = j.id
           WHERE m.evento_id = $1 AND m.activo = true
           GROUP BY m.id, u.nombre_mostrado
           ORDER BY u.nombre_mostrado`,
      [eventoId]
    );

    const por_monitor = porMonitor.rows.map((row) => {
      const totalJovenes = Number(row.total_jovenes || 0);
      return {
        monitor_id: row.monitor_id,
        nombre: row.nombre_mostrado,
        total_jovenes: totalJovenes,
        recaudado: Number(row.recaudado || 0),
        esperado: precioEfectivo * totalJovenes,
      };
    });

    const total_recaudado = por_monitor.reduce((acc, curr) => acc + curr.recaudado, 0);
    const total_esperado = por_monitor.reduce((acc, curr) => acc + curr.esperado, 0);

    res.json({
      data: {
        evento_id: eventoId,
        total_recaudado,
        total_esperado,
        por_monitor,
      },
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

    if (await hasAsignacionEventosTable()) {
      await pool.query(
        `UPDATE asignacion_eventos SET enlace_token = $1
         WHERE monitor_id = $2`,
        [newToken, monitorId]
      );
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
    const withAsignaciones = await hasAsignacionEventosTable();
    const result = await pool.query(
      withAsignaciones
        ? `SELECT m.id, ae.enlace_token, ae.evento_id, m.usuario_id, e.nombre as evento_nombre,
                  u.email, u.nombre_mostrado, ae.max_jovenes
           FROM asignacion_eventos ae
           JOIN monitores m ON m.id = ae.monitor_id
           JOIN eventos e ON ae.evento_id = e.id
           JOIN usuarios u ON m.usuario_id = u.id
           WHERE ae.activo = true AND m.activo = true
           ORDER BY e.nombre, u.nombre_mostrado`
        : `SELECT m.id, m.enlace_token, m.evento_id, m.usuario_id, e.nombre as evento_nombre,
                  u.email, u.nombre_mostrado, NULL::int as max_jovenes
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
      max_jovenes: monitor.max_jovenes,
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

// GET /api/admin/configuracion
const getConfiguracion = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT clave, valor, tipo
       FROM configuracion
       ORDER BY clave ASC`
    );

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/configuracion
const updateConfiguracion = async (req, res, next) => {
  try {
    const payload = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.items)
        ? req.body.items
        : [];

    if (!payload.length) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Body must be an array of { clave, valor }',
        },
      });
    }

    for (const item of payload) {
      const clave = String(item?.clave || '').trim();
      const valor = String(item?.valor ?? '').trim();

      if (!allowedConfigKeys.has(clave)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_CONFIG_KEY',
            message: `Clave no permitida: ${clave}`,
          },
        });
      }

      if (clave.startsWith('color_') && !/^#[0-9A-Fa-f]{6}$/.test(valor)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_COLOR',
            message: `Valor inválido para ${clave}`,
          },
        });
      }

      if (clave === 'contacto_email' && valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_EMAIL',
            message: 'Formato de email inválido',
          },
        });
      }

      await pool.query(
        `UPDATE configuracion SET valor = $2 WHERE clave = $1`,
        [clave, valor]
      );
    }

    const updated = await pool.query(
      `SELECT clave, valor, tipo FROM configuracion ORDER BY clave ASC`
    );
    res.json({ mensaje: 'Configuración actualizada', data: updated.rows, total: updated.rows.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/dashboard
const getAdminDashboard = async (req, res, next) => {
  try {
    const totals = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM eventos WHERE activo = true) as total_eventos,
        (SELECT COUNT(*)::int FROM monitores WHERE activo = true) as total_monitores,
        (SELECT COUNT(*)::int FROM jovenes) as total_jovenes,
        (SELECT COALESCE(SUM(CASE WHEN pagado = true THEN cantidad - COALESCE(descuento, 0) ELSE 0 END), 0) FROM pagos) as recaudacion_global`
    );

    res.json({ data: totals.rows[0] || { total_eventos: 0, total_monitores: 0, total_jovenes: 0, recaudacion_global: 0 } });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/monitores/:monitorId/dashboard
const getMonitorDashboard = async (req, res, next) => {
  try {
    const { monitorId } = req.params;
    const withAsignaciones = await hasAsignacionEventosTable();

    const monitorExists = await pool.query(
      `SELECT m.id, u.nombre_mostrado
       FROM monitores m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.id = $1`,
      [monitorId]
    );

    if (!monitorExists.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      });
    }

    const eventos = await pool.query(
      withAsignaciones
        ? `SELECT e.id as evento_id, e.nombre, ae.activo, ae.max_jovenes
           FROM asignacion_eventos ae
           JOIN eventos e ON e.id = ae.evento_id
           WHERE ae.monitor_id = $1
           ORDER BY e.nombre`
        : `SELECT e.id as evento_id, e.nombre, true as activo, NULL::int as max_jovenes
           FROM monitores m
           JOIN eventos e ON e.id = m.evento_id
           WHERE m.id = $1
           ORDER BY e.nombre`,
      [monitorId]
    );

    const jovenesPorEvento = await pool.query(
      `SELECT j.evento_id, e.nombre as evento_nombre, COUNT(j.id)::int as total_jovenes
       FROM jovenes j
       JOIN eventos e ON e.id = j.evento_id
       WHERE j.monitor_id = $1
       GROUP BY j.evento_id, e.nombre
       ORDER BY e.nombre`,
      [monitorId]
    );

    const recaudacion = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN p.pagado = true THEN p.cantidad - COALESCE(p.descuento, 0) ELSE 0 END), 0) as total
       FROM jovenes j
       LEFT JOIN pagos p ON p.joven_id = j.id
       WHERE j.monitor_id = $1`,
      [monitorId]
    );

    res.json({
      data: {
        monitor: monitorExists.rows[0],
        eventos: eventos.rows,
        jovenes_por_evento: jovenesPorEvento.rows,
        recaudacion: Number(recaudacion.rows[0]?.total || 0),
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/monitores/:monitorId/ficheros
const getMonitorFicherosAdmin = async (req, res, next) => {
  try {
    const { monitorId } = req.params;

    const monitorExists = await pool.query('SELECT id FROM monitores WHERE id = $1', [monitorId]);
    if (!monitorExists.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      });
    }

    const result = await pool.query(
      `SELECT id, monitor_id, nombre_original, mime_type, subido_en
       FROM monitor_ficheros
       WHERE monitor_id = $1
       ORDER BY subido_en DESC`,
      [monitorId]
    );

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/monitores/perfiles
const getMonitoresPerfiles = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.id as monitor_id,
              m.usuario_id,
              u.email,
              u.nombre_mostrado,
              u.activo,
              COALESCE(u.notificacion_email, u.email) as notificacion_email,
              COALESCE(u.notificacion_webhook, '') as notificacion_webhook,
              COALESCE(u.notificacion_email_habilitada, true) as notificacion_email_habilitada,
              COUNT(DISTINCT j.id)::int as total_jovenes
       FROM monitores m
       JOIN usuarios u ON u.id = m.usuario_id
       LEFT JOIN jovenes j ON j.monitor_id = m.id
       WHERE u.rol = 'monitor' AND m.activo = true
       GROUP BY m.id, m.usuario_id, u.email, u.nombre_mostrado, u.activo,
                u.notificacion_email, u.notificacion_webhook, u.notificacion_email_habilitada
       ORDER BY u.nombre_mostrado ASC`
    );

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/monitores/:monitorId/perfil
const getMonitorPerfilAdmin = async (req, res, next) => {
  try {
    const { monitorId } = req.params;

    const result = await pool.query(
      `SELECT m.id as monitor_id,
              m.usuario_id,
              u.email,
              u.nombre_mostrado,
              u.activo,
              COALESCE(u.notificacion_email, u.email) as notificacion_email,
              COALESCE(u.notificacion_webhook, '') as notificacion_webhook,
              COALESCE(u.notificacion_email_habilitada, true) as notificacion_email_habilitada
       FROM monitores m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.id = $1 AND u.rol = 'monitor'
       LIMIT 1`,
      [monitorId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      });
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/monitores/:monitorId/perfil
const updateMonitorPerfilAdmin = async (req, res, next) => {
  try {
    const { monitorId } = req.params;
    const email = String(req.body?.email || '').trim();
    const nombre_mostrado = String(req.body?.nombre_mostrado || '').trim();
    const notificacion_email = String(req.body?.notificacion_email || '').trim();
    const notificacion_webhook = String(req.body?.notificacion_webhook || '').trim();
    const notificacion_email_habilitada = req.body?.notificacion_email_habilitada !== undefined
      ? Boolean(req.body.notificacion_email_habilitada)
      : true;

    if (!email || !nombre_mostrado) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'email and nombre_mostrado are required' },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: { code: 'INVALID_EMAIL', message: 'Invalid email format' },
      });
    }

    if (notificacion_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificacion_email)) {
      return res.status(400).json({
        error: { code: 'INVALID_NOTIFICATION_EMAIL', message: 'Invalid notification email format' },
      });
    }

    if (notificacion_webhook && !/^https?:\/\//i.test(notificacion_webhook)) {
      return res.status(400).json({
        error: { code: 'INVALID_WEBHOOK', message: 'Webhook must start with http:// or https://' },
      });
    }

    const monitorResult = await pool.query(
      `SELECT usuario_id
       FROM monitores
       WHERE id = $1
       LIMIT 1`,
      [monitorId]
    );

    if (!monitorResult.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      });
    }

    const usuarioId = monitorResult.rows[0].usuario_id;

    const updated = await pool.query(
      `UPDATE usuarios
       SET email = $1,
           nombre_mostrado = $2,
           notificacion_email = $3,
           notificacion_webhook = $4,
           notificacion_email_habilitada = $5,
           actualizado_en = NOW()
       WHERE id = $6 AND rol = 'monitor'
       RETURNING id, email, nombre_mostrado,
                 COALESCE(notificacion_email, email) as notificacion_email,
                 COALESCE(notificacion_webhook, '') as notificacion_webhook,
                 COALESCE(notificacion_email_habilitada, true) as notificacion_email_habilitada`,
      [email, nombre_mostrado, notificacion_email || null, notificacion_webhook || null, notificacion_email_habilitada, usuarioId]
    );

    if (!updated.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      });
    }

    res.json({ mensaje: 'Perfil de monitor actualizado', data: updated.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: { code: 'EMAIL_EXISTS', message: 'Email already exists' },
      });
    }
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

// POST /api/admin/jovenes
const createJovenAdmin = async (req, res, next) => {
  try {
    const { nombre, apellidos, monitor_id, evento_id } = req.body;

    if (!nombre || !apellidos || !monitor_id) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre, apellidos and monitor_id are required',
        },
      });
    }

    const monitorResult = await pool.query(
      `SELECT id, evento_id
       FROM monitores
       WHERE id = $1 AND activo = true`,
      [monitor_id]
    );

    if (!monitorResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: 'Monitor not found',
        },
      });
    }

    const monitorEventoId = monitorResult.rows[0].evento_id;
    const finalEventoId = evento_id || monitorEventoId;

    if (monitorEventoId && finalEventoId !== monitorEventoId) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EVENTO_MONITOR',
          message: 'El monitor no está asignado a ese evento en el modelo legado',
        },
      });
    }

    const jovenResult = await pool.query(
      `INSERT INTO jovenes (nombre, apellidos, monitor_id, evento_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, apellidos, monitor_id, evento_id, creado_en`,
      [nombre, apellidos, monitor_id, finalEventoId]
    );

    res.status(201).json({
      mensaje: 'Joven creado exitosamente',
      data: jovenResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/jovenes/:jovenId
const updateJovenAdmin = async (req, res, next) => {
  try {
    const { jovenId } = req.params;
    const updates = [];
    const values = [];

    if (req.body?.nombre !== undefined) {
      values.push(String(req.body.nombre || '').trim());
      updates.push(`nombre = $${values.length}`);
    }

    if (req.body?.apellidos !== undefined) {
      values.push(String(req.body.apellidos || '').trim());
      updates.push(`apellidos = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({
        error: {
          code: 'NO_FIELDS_TO_UPDATE',
          message: 'No fields provided to update',
        },
      });
    }

    values.push(jovenId);
    const result = await pool.query(
      `UPDATE jovenes
       SET ${updates.join(', ')}, actualizado_en = now()
       WHERE id = $${values.length}
       RETURNING id, nombre, apellidos, monitor_id, evento_id, actualizado_en`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'JOVEN_NOT_FOUND',
          message: 'Youth record not found',
        },
      });
    }

    res.json({
      mensaje: 'Joven actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/jovenes/:jovenId
const deleteJovenAdmin = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { jovenId } = req.params;
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM documento_validaciones
       WHERE documento_id IN (SELECT id FROM documentos WHERE joven_id = $1)`,
      [jovenId]
    );
    await client.query('DELETE FROM documentos WHERE joven_id = $1', [jovenId]);
    await client.query('DELETE FROM pagos WHERE joven_id = $1', [jovenId]);
    await client.query('DELETE FROM joven_accesos WHERE joven_id = $1', [jovenId]);

    const result = await client.query(
      `DELETE FROM jovenes WHERE id = $1
       RETURNING id, nombre, apellidos`,
      [jovenId]
    );

    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: {
          code: 'JOVEN_NOT_FOUND',
          message: 'Youth record not found',
        },
      });
    }

    await client.query('COMMIT');
    res.json({
      mensaje: 'Joven eliminado exitosamente',
      data: result.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// GET /api/admin/jovenes/:jovenId/perfil
const getJovenPerfilAdmin = async (req, res, next) => {
  try {
    const { jovenId } = req.params;

    const jovenResult = await pool.query(
      `SELECT j.id, j.nombre, j.apellidos, j.creado_en,
              e.id as evento_id, e.nombre as evento_nombre,
              m.id as monitor_id, u.nombre_mostrado as monitor_nombre
       FROM jovenes j
       JOIN eventos e ON e.id = j.evento_id
       JOIN monitores m ON m.id = j.monitor_id
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE j.id = $1`,
      [jovenId]
    );

    if (!jovenResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'JOVEN_NOT_FOUND',
          message: 'Youth record not found',
        },
      });
    }

    const documentosResult = await pool.query(
      `SELECT d.id, d.tipo, d.nombre_original, d.mime_type, d.subido_en,
              COALESCE(v.validado, false) as validado, v.validado_en
       FROM documentos d
       LEFT JOIN documento_validaciones v ON v.documento_id = d.id
       WHERE d.joven_id = $1
       ORDER BY d.subido_en DESC`,
      [jovenId]
    );

    const pagosResult = await pool.query(
      `SELECT id, plazo_numero, cantidad, pagado, descuento, es_especial, nota_especial, fecha_pago, creado_en
       FROM pagos
       WHERE joven_id = $1
       ORDER BY plazo_numero ASC, creado_en ASC`,
      [jovenId]
    );

    res.json({
      data: {
        joven: jovenResult.rows[0],
        documentos: documentosResult.rows,
        pagos: pagosResult.rows,
      },
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
    const withAsignaciones = await hasAsignacionEventosTable();

    const result = await pool.query(
      `SELECT m.id as monitor_id, m.evento_id, e.nombre as evento_nombre, 
              e.tipo, e.fecha_inicio, e.fecha_fin, m.activo,
              ${withAsignaciones ? 'COALESCE(ae.enlace_token, m.enlace_token) as enlace_token,' : 'm.enlace_token,'}
              ${withAsignaciones ? 'ae.max_jovenes, COALESCE(ae.activo, true) as asignacion_activa' : 'NULL::int as max_jovenes, true as asignacion_activa'}
       FROM monitores m
       JOIN eventos e ON m.evento_id = e.id
       ${withAsignaciones ? 'LEFT JOIN asignacion_eventos ae ON ae.monitor_id = m.id AND ae.evento_id = m.evento_id' : ''}
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
    const { usuario_id, evento_id, max_jovenes } = req.body;

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

    const monitor = result.rows[0];

    if (await hasAsignacionEventosTable()) {
      await pool.query(
        `INSERT INTO asignacion_eventos (monitor_id, evento_id, enlace_token, max_jovenes, activo)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (monitor_id, evento_id)
         DO UPDATE SET enlace_token = EXCLUDED.enlace_token,
                       max_jovenes = COALESCE(EXCLUDED.max_jovenes, asignacion_eventos.max_jovenes),
                       activo = true`,
        [monitor.id, monitor.evento_id, monitor.enlace_token, max_jovenes ?? null]
      );
    }

    res.status(201).json({
      mensaje: 'Monitor asignado exitosamente',
      monitor,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/monitores/:monitorId - Eliminar asignación
const removeMonitorEvento = async (req, res, next) => {
  try {
    const { monitorId } = req.params;

    if (await hasAsignacionEventosTable()) {
      await pool.query('DELETE FROM asignacion_eventos WHERE monitor_id = $1', [monitorId]);
    }

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

// GET /api/admin/monitores/:monitorId/eventos
const getMonitorEventos = async (req, res, next) => {
  try {
    const { monitorId } = req.params;

    const result = await pool.query(
      `SELECT m.id as monitor_id, m.usuario_id, m.evento_id, e.nombre as evento_nombre,
              e.tipo, m.enlace_token,
              ${await hasAsignacionEventosTable() ? 'ae.max_jovenes, COALESCE(ae.activo, true) as asignacion_activa' : 'NULL::int as max_jovenes, true as asignacion_activa'}
       FROM monitores m
       JOIN eventos e ON e.id = m.evento_id
       ${await hasAsignacionEventosTable() ? 'LEFT JOIN asignacion_eventos ae ON ae.monitor_id = m.id AND ae.evento_id = m.evento_id' : ''}
       WHERE m.id = $1 OR m.usuario_id = $1
       ORDER BY e.fecha_inicio DESC NULLS LAST`,
      [monitorId]
    );

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/monitores/:monitorId/eventos
const assignMonitorEventoByPath = async (req, res, next) => {
  try {
    const { monitorId } = req.params;
    const { evento_id, max_jovenes } = req.body;

    if (!evento_id) {
      return res.status(400).json({
        error: { code: 'MISSING_FIELDS', message: 'evento_id is required' },
      });
    }

    const monitorBase = await pool.query(
      `SELECT id, usuario_id FROM monitores WHERE id = $1
       UNION
       SELECT id, usuario_id FROM monitores WHERE usuario_id = $1
       LIMIT 1`,
      [monitorId]
    );

    if (!monitorBase.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      });
    }

    const usuarioId = monitorBase.rows[0].usuario_id;
    const result = await pool.query(
      `INSERT INTO monitores (usuario_id, evento_id)
       VALUES ($1, $2)
       ON CONFLICT (usuario_id, evento_id) DO UPDATE SET activo = true
       RETURNING id, usuario_id, evento_id, enlace_token, activo`,
      [usuarioId, evento_id]
    );

    const monitor = result.rows[0];

    if (await hasAsignacionEventosTable()) {
      await pool.query(
        `INSERT INTO asignacion_eventos (monitor_id, evento_id, enlace_token, max_jovenes, activo)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (monitor_id, evento_id)
         DO UPDATE SET max_jovenes = EXCLUDED.max_jovenes,
                       enlace_token = EXCLUDED.enlace_token,
                       activo = true`,
        [monitor.id, monitor.evento_id, monitor.enlace_token, max_jovenes ?? null]
      );
    }

    res.status(201).json({ mensaje: 'Asignación creada', data: monitor });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/monitores/:monitorId/eventos/:eventoId
const updateMonitorEventoAssignment = async (req, res, next) => {
  try {
    const { monitorId, eventoId } = req.params;
    const { max_jovenes, activo } = req.body;

    const monitorResult = await pool.query(
      `SELECT id, usuario_id FROM monitores WHERE id = $1 AND evento_id = $2
       UNION
       SELECT id, usuario_id FROM monitores WHERE usuario_id = $1 AND evento_id = $2
       LIMIT 1`,
      [monitorId, eventoId]
    );

    if (!monitorResult.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_EVENT_NOT_FOUND', message: 'Assignment not found' },
      });
    }

    const monitor = monitorResult.rows[0];

    if (activo !== undefined) {
      await pool.query('UPDATE monitores SET activo = $1 WHERE id = $2', [Boolean(activo), monitor.id]);
    }

    if (await hasAsignacionEventosTable()) {
      await pool.query(
        `INSERT INTO asignacion_eventos (monitor_id, evento_id, enlace_token, max_jovenes, activo)
         SELECT m.id, m.evento_id, m.enlace_token, $3, $4
         FROM monitores m
         WHERE m.id = $1 AND m.evento_id = $2
         ON CONFLICT (monitor_id, evento_id)
         DO UPDATE SET max_jovenes = COALESCE($3, asignacion_eventos.max_jovenes),
                       activo = COALESCE($4, asignacion_eventos.activo)`,
        [monitor.id, eventoId, max_jovenes ?? null, activo !== undefined ? Boolean(activo) : null]
      );
    }

    res.json({ mensaje: 'Asignación actualizada' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/monitores/:monitorId/eventos/:eventoId
const removeMonitorEventoByEvento = async (req, res, next) => {
  try {
    const { monitorId, eventoId } = req.params;

    const result = await pool.query(
      `DELETE FROM monitores
       WHERE (id = $1 OR usuario_id = $1) AND evento_id = $2
       RETURNING id, usuario_id, evento_id`,
      [monitorId, eventoId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_EVENT_NOT_FOUND', message: 'Assignment not found' },
      });
    }

    if (await hasAsignacionEventosTable()) {
      await pool.query(
        `DELETE FROM asignacion_eventos
         WHERE monitor_id = $1 AND evento_id = $2`,
        [result.rows[0].id, eventoId]
      );
    }

    res.json({ mensaje: 'Asignación eliminada', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/monitores/:monitorId/eventos/:eventoId/revocar-enlace
const revokeMonitorTokenByEvento = async (req, res, next) => {
  try {
    const { monitorId, eventoId } = req.params;
    const newToken = generateUUID();

    const result = await pool.query(
      `UPDATE monitores
       SET enlace_token = $1
       WHERE (id = $2 OR usuario_id = $2) AND evento_id = $3
       RETURNING id, usuario_id, evento_id, enlace_token`,
      [newToken, monitorId, eventoId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_EVENT_NOT_FOUND', message: 'Assignment not found' },
      });
    }

    if (await hasAsignacionEventosTable()) {
      await pool.query(
        `UPDATE asignacion_eventos
         SET enlace_token = $1
         WHERE monitor_id = $2 AND evento_id = $3`,
        [newToken, result.rows[0].id, eventoId]
      );
    }

    res.json({ mensaje: 'Enlace revocado', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/monitores/:monitorId/max-jovenes
const updateMonitorMaxJovenes = async (req, res, next) => {
  try {
    const { monitorId } = req.params;
    const maxJovenes = req.body?.max_jovenes;

    if (maxJovenes !== null && maxJovenes !== undefined && (!Number.isInteger(Number(maxJovenes)) || Number(maxJovenes) < 1)) {
      return res.status(400).json({
        error: { code: 'INVALID_MAX_JOVENES', message: 'max_jovenes must be null or integer >= 1' },
      });
    }

    if (!(await hasAsignacionEventosTable())) {
      return res.status(400).json({
        error: { code: 'UNSUPPORTED', message: 'asignacion_eventos table is not available' },
      });
    }

    const result = await pool.query(
      `UPDATE asignacion_eventos ae
       SET max_jovenes = $2
       FROM monitores m
       WHERE ae.monitor_id = m.id AND (m.id = $1 OR m.usuario_id = $1)
       RETURNING ae.monitor_id, ae.evento_id, ae.max_jovenes`,
      [monitorId, maxJovenes === null ? null : Number(maxJovenes)]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: { code: 'MONITOR_NOT_FOUND', message: 'Monitor not found' },
      });
    }

    res.json({ mensaje: 'max_jovenes actualizado', data: result.rows, total: result.rows.length });
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
  getEventoRecaudacionAdmin,
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
  getMonitorEventos,
  assignMonitorEventoByPath,
  updateMonitorEventoAssignment,
  removeMonitorEventoByEvento,
  revokeMonitorTokenByEvento,
  updateMonitorMaxJovenes,
  revokeMonitorToken,
  getConfiguracion,
  updateConfiguracion,
  getAdminDashboard,
  getMonitorDashboard,
  getMonitorFicherosAdmin,
  getMonitoresPerfiles,
  getMonitorPerfilAdmin,
  updateMonitorPerfilAdmin,
  getRegistrationLinks,
  getJovenes,
  createJovenAdmin,
  updateJovenAdmin,
  deleteJovenAdmin,
  getJovenPerfilAdmin,
};
