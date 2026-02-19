const pool = require('../models/db');
const { validateJoven } = require('../middleware/validators');
const { sendNewYouthNotification } = require('../services/notifications');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (value) => typeof value === 'string' && uuidRegex.test(value);

// GET /register/:token - Obtener información del evento
const getEventoInfo = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!isValidUUID(token)) {
      return res.status(404).json({
        error: {
          code: 'EVENTO_NOT_FOUND',
          message: 'Event not found or link is inactive',
        },
      });
    }

    // Validar token
    const monitorResult = await pool.query(
      `SELECT m.id, m.usuario_id, m.evento_id, u.nombre_mostrado, e.nombre, e.tipo, e.fecha_inicio, e.fecha_fin
       FROM monitores m
       JOIN usuarios u ON m.usuario_id = u.id
       JOIN eventos e ON m.evento_id = e.id
       WHERE m.enlace_token = $1 AND m.activo = true`,
      [token]
    );

    if (!monitorResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'EVENTO_NOT_FOUND',
          message: 'Event not found or link is inactive',
        },
      });
    }

    const { id, usuario_id, evento_id, nombre_mostrado, nombre, tipo, fecha_inicio, fecha_fin } = monitorResult.rows[0];

    res.json({
      evento: {
        nombre,
        tipo,
        fecha_inicio,
        fecha_fin,
      },
      monitor: {
        nombre: nombre_mostrado,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /register/:token/joven - Registrar nuevo joven
const registerJoven = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { nombre, apellidos } = req.body;

    if (!isValidUUID(token)) {
      return res.status(404).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or inactive token',
        },
      });
    }

    // Validar token del monitor
    const monitorResult = await pool.query(
      `SELECT m.id, m.usuario_id, m.evento_id, u.email, u.nombre_mostrado, e.nombre
       FROM monitores m
       JOIN usuarios u ON m.usuario_id = u.id
       JOIN eventos e ON m.evento_id = e.id
       WHERE m.enlace_token = $1 AND m.activo = true`,
      [token]
    );

    if (!monitorResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or inactive token',
        },
      });
    }

    const { id: monitorId, usuario_id: monitorUserId, evento_id: eventoId, email: monitorEmail, nombre_mostrado, nombre: eventoNombre } = monitorResult.rows[0];

    // Crear nuevo joven
    const jovenResult = await pool.query(
      `INSERT INTO jovenes (nombre, apellidos, monitor_id, evento_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, apellidos, creado_en`,
      [nombre, apellidos, monitorId, eventoId]
    );

    const joven = jovenResult.rows[0];

    // Enviar notificación al monitor
    await sendNewYouthNotification(
      {
        email: monitorEmail,
        nombre_mostrado,
      },
      {
        nombre: joven.nombre,
        apellidos: joven.apellidos,
      },
      {
        nombre: eventoNombre,
      }
    );

    res.status(201).json({
      mensaje: 'Joven registrado exitosamente',
      joven: {
        id: joven.id,
        nombre: joven.nombre,
        apellidos: joven.apellidos,
        creado_en: joven.creado_en,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /register/:token/joven/:jovenId/documento - Subir documento
const uploadDocument = async (req, res, next) => {
  try {
    const { token, jovenId } = req.params;
    const { tipo } = req.body;

    if (!isValidUUID(token) || !isValidUUID(jovenId)) {
      return res.status(404).json({
        error: {
          code: 'JOVEN_NOT_FOUND',
          message: 'Youth record not found',
        },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'File is required',
        },
      });
    }

    // Validar tipo de documento
    const tiposValidos = ['autorizacion_paterna', 'tarjeta_sanitaria', 'otro'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DOCUMENT_TYPE',
          message: 'Invalid document type',
        },
      });
    }

    // Validar que el token corresponde al joven
    const jovenResult = await pool.query(
      `SELECT j.id, j.monitor_id, m.enlace_token, m.usuario_id, u.email, u.nombre_mostrado, j.nombre, e.nombre as evento_nombre
       FROM jovenes j
       JOIN monitores m ON j.monitor_id = m.id
       JOIN usuarios u ON m.usuario_id = u.id
       JOIN eventos e ON j.evento_id = e.id
       WHERE j.id = $1 AND m.enlace_token = $2 AND m.activo = true`,
      [jovenId, token]
    );

    if (!jovenResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'JOVEN_NOT_FOUND',
          message: 'Youth record not found',
        },
      });
    }

    const { nombre: jovenNombre, evento_nombre: eventoNombre, email: monitorEmail, nombre_mostrado } = jovenResult.rows[0];
    const rutaInterna = `${jovenId}/${req.file.filename}`;

    // Guardar documento en BD
    const docResult = await pool.query(
      `INSERT INTO documentos (joven_id, tipo, ruta_interna, nombre_original, mime_type, tamaño_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, creado_en`,
      [jovenId, tipo, rutaInterna, req.file.originalname, req.file.mimetype, req.file.size]
    );

    const doc = docResult.rows[0];

    // Enviar notificación al monitor (opcional, comentado por ahora)
    // await sendDocumentNotification(...)

    res.status(201).json({
      mensaje: 'Documento subido exitosamente',
      documento: {
        id: doc.id,
        tipo,
        nombre_original: req.file.originalname,
        tamaño: req.file.size,
        subido_en: doc.creado_en,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEventoInfo,
  registerJoven,
  uploadDocument,
};
