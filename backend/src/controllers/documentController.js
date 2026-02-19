const fs = require('fs');
const path = require('path');
const pool = require('../models/db');

// GET /api/documentos/:docId - Descargar documento
const getDocument = async (req, res, next) => {
  try {
    const { docId } = req.params;
    const userId = req.user.userId;

    // Obtener documento y verificar permisos
    const docResult = await pool.query(
      `SELECT d.id, d.ruta_interna, d.nombre_original, d.mime_type, j.monitor_id, m.usuario_id
       FROM documentos d
       JOIN jovenes j ON d.joven_id = j.id
       JOIN monitores m ON j.monitor_id = m.id
       WHERE d.id = $1`,
      [docId]
    );

    if (!docResult.rows.length) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    const doc = docResult.rows[0];

    // Verificar que el usuario es el monitor o un organizador
    if (doc.usuario_id !== userId && req.user.rol !== 'organizador') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this document',
        },
      });
    }

    // Construir ruta del archivo
    const filePath = path.join(process.env.UPLOADS_PATH || '/data/uploads', doc.ruta_interna);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'File not found on server',
        },
      });
    }

    // Servir archivo
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.nombre_original}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDocument,
};
