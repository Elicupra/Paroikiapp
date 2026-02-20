const pool = require('../models/db');
const { validateJoven } = require('../middleware/validators');
const { sendNewYouthNotification } = require('../services/notifications');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (value) => typeof value === 'string' && uuidRegex.test(value);

const MAX_JOVENES_POR_MONITOR_EVENTO = 10;

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

    const { id: monitorId, evento_id: eventoId, email: monitorEmail, nombre_mostrado, nombre: eventoNombre } = monitorResult.rows[0];

    const countResult = await pool.query(
      'SELECT COUNT(*)::int as total FROM jovenes WHERE monitor_id = $1 AND evento_id = $2',
      [monitorId, eventoId]
    );

    if ((countResult.rows[0]?.total || 0) >= MAX_JOVENES_POR_MONITOR_EVENTO) {
      return res.status(409).json({
        error: {
          code: 'MAX_JOVENES_REACHED',
          message: `Este monitor ya alcanzó el máximo de ${MAX_JOVENES_POR_MONITOR_EVENTO} jóvenes para el evento`,
        },
      });
    }

    // Crear nuevo joven
    const jovenResult = await pool.query(
      `INSERT INTO jovenes (nombre, apellidos, monitor_id, evento_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, apellidos, creado_en`,
      [nombre, apellidos, monitorId, eventoId]
    );

    const joven = jovenResult.rows[0];

    const accessResult = await pool.query(
      `INSERT INTO joven_accesos (joven_id)
       VALUES ($1)
       ON CONFLICT (joven_id) DO UPDATE SET joven_id = EXCLUDED.joven_id
       RETURNING token`,
      [joven.id]
    );
    const accessToken = accessResult.rows[0].token;

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
      acceso: {
        token: accessToken,
        url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/registro/${accessToken}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// GET /register/acceso/:accessToken - Ver datos de inscripción del joven
const getJovenAccessInfo = async (req, res, next) => {
  try {
    const { accessToken } = req.params;

    if (!isValidUUID(accessToken)) {
      return res.status(404).json({
        error: {
          code: 'ACCESS_NOT_FOUND',
          message: 'Acceso no válido',
        },
      });
    }

    const result = await pool.query(
      `SELECT j.id, j.nombre, j.apellidos, j.creado_en,
              e.id as evento_id, e.nombre as evento_nombre, e.tipo, e.fecha_inicio, e.fecha_fin,
              m.id as monitor_id, u.nombre_mostrado as monitor_nombre
       FROM joven_accesos ja
       JOIN jovenes j ON ja.joven_id = j.id
       JOIN eventos e ON j.evento_id = e.id
       JOIN monitores m ON j.monitor_id = m.id
       JOIN usuarios u ON m.usuario_id = u.id
       WHERE ja.token = $1`,
      [accessToken]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: {
          code: 'ACCESS_NOT_FOUND',
          message: 'Acceso no válido',
        },
      });
    }

    const docsResult = await pool.query(
      `SELECT d.id, d.tipo, d.nombre_original, d.mime_type, d.subido_en,
              COALESCE(v.validado, false) as validado
       FROM joven_accesos ja
       JOIN documentos d ON d.joven_id = ja.joven_id
       LEFT JOIN documento_validaciones v ON v.documento_id = d.id
       WHERE ja.token = $1
       ORDER BY d.subido_en DESC`,
      [accessToken]
    );

    res.json({
      joven: result.rows[0],
      documentos: docsResult.rows,
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
    const mimeType = req.file.detectedMimeType || req.file.mimetype;

    // Guardar documento en BD
    const docResult = await pool.query(
      `INSERT INTO documentos (joven_id, tipo, ruta_interna, nombre_original, mime_type, tamaño_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, subido_en`,
      [jovenId, tipo, rutaInterna, req.file.originalname, mimeType, req.file.size]
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
        subido_en: doc.subido_en,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /register/acceso/:accessToken/documento - Subir documento desde enlace único del joven
const uploadDocumentByAccess = async (req, res, next) => {
  try {
    const { accessToken } = req.params;
    const { tipo } = req.body;

    if (!isValidUUID(accessToken)) {
      return res.status(404).json({
        error: { code: 'ACCESS_NOT_FOUND', message: 'Acceso no válido' },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: { code: 'NO_FILE', message: 'File is required' },
      });
    }

    const tiposValidos = ['autorizacion_paterna', 'tarjeta_sanitaria'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DOCUMENT_TYPE',
          message: 'Tipo de documento inválido',
        },
      });
    }

    const accessResult = await pool.query(
      `SELECT ja.joven_id FROM joven_accesos ja WHERE ja.token = $1`,
      [accessToken]
    );

    if (!accessResult.rows.length) {
      return res.status(404).json({
        error: { code: 'ACCESS_NOT_FOUND', message: 'Acceso no válido' },
      });
    }

    const jovenId = accessResult.rows[0].joven_id;
    const rutaInterna = `${jovenId}/${req.file.filename}`;
    const mimeType = req.file.detectedMimeType || req.file.mimetype;

    const docResult = await pool.query(
      `INSERT INTO documentos (joven_id, tipo, ruta_interna, nombre_original, mime_type, tamaño_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, subido_en`,
      [jovenId, tipo, rutaInterna, req.file.originalname, mimeType, req.file.size]
    );

    res.status(201).json({
      mensaje: 'Documento subido exitosamente',
      documento: docResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEventoInfo,
  registerJoven,
  getJovenAccessInfo,
  uploadDocument,
  uploadDocumentByAccess,
};
