const pool = require('../models/db');

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

module.exports = {
  getEventosPublicos,
};
