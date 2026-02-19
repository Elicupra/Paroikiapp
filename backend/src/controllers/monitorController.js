const pool = require('../models/db');

const getEffectiveUserId = (req) => req.user.simulatedUserId || req.user.userId;

// GET /api/monitor/jovenes - Listar jóvenes del monitor
const getJovenes = async (req, res, next) => {
  try {
    const userId = getEffectiveUserId(req);

    // Obtener el monitor asociado al usuario
    const monitorResult = await pool.query(
      'SELECT id, evento_id FROM monitores WHERE usuario_id = $1 AND activo = true',
      [userId]
    );

    if (!monitorResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'MONITOR_NOT_FOUND',
          message: 'Monitor profile not found',
        },
      });
    }

    const { id: monitorId } = monitorResult.rows[0];

    // Obtener jóvenes del monitor
    const query = `
      SELECT j.id, j.nombre, j.apellidos, j.creado_en,
             COUNT(DISTINCT d.id) as documentos_count,
             COUNT(DISTINCT p.id) as pagos_count,
             SUM(CASE WHEN p.pagado = true THEN p.cantidad ELSE 0 END) as total_pagado
      FROM jovenes j
      LEFT JOIN documentos d ON j.id = d.joven_id
      LEFT JOIN pagos p ON j.id = p.joven_id
      WHERE j.monitor_id = $1
      GROUP BY j.id, j.nombre, j.apellidos, j.creado_en
      ORDER BY j.creado_en DESC
    `;

    const jovenResult = await pool.query(query, [monitorId]);

    res.json({
      data: jovenResult.rows,
      total: jovenResult.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/monitor/jovenes/:jovenId - Detalle de un joven
const getJovenDetalle = async (req, res, next) => {
  try {
    const userId = getEffectiveUserId(req);
    const { jovenId } = req.params;

    // Verificar que el joven pertenece al monitor actual
    const jovenResult = await pool.query(
      `SELECT j.id, j.nombre, j.apellidos, j.creado_en, m.usuario_id
       FROM jovenes j
       JOIN monitores m ON j.monitor_id = m.id
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

    const joven = jovenResult.rows[0];
    if (joven.usuario_id !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view your own youth records',
        },
      });
    }

    // Obtener documentos
    const docsResult = await pool.query(
      'SELECT id, tipo, nombre_original, mime_type, subido_en FROM documentos WHERE joven_id = $1',
      [jovenId]
    );

    // Obtener pagos
    const pagosResult = await pool.query(
      `SELECT id, plazo_numero, cantidad, pagado, descuento, fecha_pago, es_especial
       FROM pagos
       WHERE joven_id = $1
       ORDER BY plazo_numero ASC`,
      [jovenId]
    );

    res.json({
      joven: {
        id: joven.id,
        nombre: joven.nombre,
        apellidos: joven.apellidos,
        creado_en: joven.creado_en,
      },
      documentos: docsResult.rows,
      pagos: pagosResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/monitor/pagos - Registrar pago
const createPago = async (req, res, next) => {
  try {
    const userId = getEffectiveUserId(req);
    const { joven_id, plazo_numero, cantidad, es_especial = false, nota_especial } = req.body;

    // Verificar que el joven pertenece al monitor actual
    const jovenResult = await pool.query(
      `SELECT j.id FROM jovenes j
       JOIN monitores m ON j.monitor_id = m.id
       WHERE j.id = $1 AND m.usuario_id = $2`,
      [joven_id, userId]
    );

    if (!jovenResult.rows.length) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only record payments for your own youth',
        },
      });
    }

    // Crear pago
    const pagoResult = await pool.query(
      `INSERT INTO pagos (joven_id, plazo_numero, cantidad, es_especial, nota_especial, registrado_por, pagado, fecha_pago)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING id, creado_en`,
      [joven_id, plazo_numero, cantidad, es_especial, nota_especial, userId]
    );

    const pago = pagoResult.rows[0];

    res.status(201).json({
      mensaje: 'Pago registrado exitosamente',
      pago: {
        id: pago.id,
        joven_id,
        plazo_numero,
        cantidad,
        pagado: true,
        registrado_en: pago.creado_en,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/monitor/pagos/:pagoId - Actualizar pago
const updatePago = async (req, res, next) => {
  try {
    const userId = getEffectiveUserId(req);
    const { pagoId } = req.params;
    const { pagado, descuento } = req.body;

    // Obtener el pago
    const pagoResult = await pool.query(
      `SELECT p.id, p.joven_id FROM pagos p
       JOIN jovenes j ON p.joven_id = j.id
       JOIN monitores m ON j.monitor_id = m.id
       WHERE p.id = $1 AND m.usuario_id = $2`,
      [pagoId, userId]
    );

    if (!pagoResult.rows.length) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You cannot modify this payment',
        },
      });
    }

    // Actualizar pago
    await pool.query(
      `UPDATE pagos SET pagado = $1, descuento = $2, actualizado_en = NOW()
       WHERE id = $3`,
      [pagado !== undefined ? pagado : true, descuento || 0, pagoId]
    );

    res.json({ mensaje: 'Pago actualizado exitosamente' });
  } catch (err) {
    next(err);
  }
};

// GET /api/monitor/registration-link - Obtener enlace de registro del monitor
const getRegistrationLink = async (req, res, next) => {
  try {
    const userId = getEffectiveUserId(req);

    // Obtener los monitores asociados al usuario
    const monitorResult = await pool.query(
      `SELECT m.id, m.enlace_token, m.evento_id, e.nombre as evento_nombre
       FROM monitores m
       JOIN eventos e ON m.evento_id = e.id
       WHERE m.usuario_id = $1 AND m.activo = true
       ORDER BY m.creado_en DESC`,
      [userId]
    );

    if (!monitorResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'NO_MONITORS',
          message: 'No registration links available',
        },
      });
    }

    const links = monitorResult.rows.map(monitor => ({
      id: monitor.id,
      token: monitor.enlace_token,
      evento_id: monitor.evento_id,
      evento_nombre: monitor.evento_nombre,
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

module.exports = {
  getJovenes,
  getJovenDetalle,
  createPago,
  updatePago,
  getRegistrationLink,
};
