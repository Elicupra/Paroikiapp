const pool = require('../models/db');
const { sendPublicContactNotification } = require('../services/notifications');

// GET /api/public/eventos - Obtener eventos activos (público)
const getEventosPublicos = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, tipo, descripcion, precio_base, fecha_inicio, fecha_fin, activo, creado_en 
       FROM eventos 
       WHERE activo = true 
       ORDER BY fecha_inicio DESC NULLS LAST, creado_en DESC`
    );

    res.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

const submitContacto = async (req, res, next) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    const email = String(req.body?.email || '').trim();
    const asunto = String(req.body?.asunto || '').trim();
    const mensaje = String(req.body?.mensaje || '').trim();

    if (!nombre || !email || !asunto || !mensaje) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'nombre, email, asunto y mensaje son obligatorios',
        },
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Formato de email inválido',
        },
      });
    }

    await sendPublicContactNotification({ nombre, email, asunto, mensaje });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

const getConfiguracionPublica = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT clave, valor, tipo
       FROM configuracion
       WHERE clave IN (
         'app_nombre',
         'parroquia_nombre',
         'parroquia_texto',
         'parroquia_logo',
         'color_primario',
         'color_secundario',
         'color_acento',
         'contacto_email',
         'contacto_telefono',
         'contacto_direccion'
       )
       ORDER BY clave ASC`
    );

    res.json({ data: result.rows, total: result.rows.length });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getEventosPublicos,
  submitContacto,
  getConfiguracionPublica,
};
