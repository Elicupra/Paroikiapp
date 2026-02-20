const fs = require('fs');
const path = require('path');
const pool = require('../models/db');

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (value) => typeof value === 'string' && uuidRegex.test(value);

const notFoundResponse = (res) => res.status(404).json({
  error: {
    code: 'FICHA_NOT_FOUND',
    message: 'Ficha no disponible',
  },
});

const getFicha = async (req, res, next) => {
  try {
    const { jovenToken } = req.params;

    if (!isValidUUID(jovenToken)) {
      return notFoundResponse(res);
    }

    const jovenResult = await pool.query(
      `SELECT j.id, j.nombre, j.apellidos, j.creado_en,
              e.id as evento_id, e.nombre as evento_nombre, e.tipo, e.fecha_inicio, e.fecha_fin
       FROM joven_accesos ja
       JOIN jovenes j ON j.id = ja.joven_id
       JOIN eventos e ON e.id = j.evento_id
       WHERE ja.token = $1`,
      [jovenToken]
    );

    if (!jovenResult.rows.length) {
      return notFoundResponse(res);
    }

    const documentosResult = await pool.query(
      `SELECT d.id, d.tipo, d.nombre_original, d.mime_type, d.subido_en
       FROM joven_accesos ja
       JOIN documentos d ON d.joven_id = ja.joven_id
       WHERE ja.token = $1
       ORDER BY d.subido_en DESC`,
      [jovenToken]
    );

    res.json({
      data: {
        ...jovenResult.rows[0],
        documentos: documentosResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

const updateFicha = async (req, res, next) => {
  try {
    const { jovenToken } = req.params;
    const updates = [];
    const values = [];

    if (!isValidUUID(jovenToken)) {
      return notFoundResponse(res);
    }

    if (req.body?.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (nombre.length < 2 || nombre.length > 100) {
        return res.status(400).json({
          error: {
            code: 'INVALID_NOMBRE',
            message: 'nombre must be 2-100 characters',
          },
        });
      }
      values.push(nombre);
      updates.push(`nombre = $${values.length}`);
    }

    if (req.body?.apellidos !== undefined) {
      const apellidos = String(req.body.apellidos).trim();
      if (apellidos.length < 2 || apellidos.length > 100) {
        return res.status(400).json({
          error: {
            code: 'INVALID_APELLIDOS',
            message: 'apellidos must be 2-100 characters',
          },
        });
      }
      values.push(apellidos);
      updates.push(`apellidos = $${values.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({
        error: {
          code: 'NO_UPDATES',
          message: 'No fields to update',
        },
      });
    }

    values.push(jovenToken);
    const result = await pool.query(
      `UPDATE jovenes j
       SET ${updates.join(', ')}, actualizado_en = now()
       FROM joven_accesos ja
       WHERE ja.joven_id = j.id AND ja.token = $${values.length}
       RETURNING j.id, j.nombre, j.apellidos, j.actualizado_en`,
      values
    );

    if (!result.rows.length) {
      return notFoundResponse(res);
    }

    res.json({
      mensaje: 'Ficha actualizada',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const uploadFichaDocumento = async (req, res, next) => {
  try {
    const { jovenToken } = req.params;
    const { tipo } = req.body;

    if (!isValidUUID(jovenToken)) {
      return notFoundResponse(res);
    }

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'File is required',
        },
      });
    }

    const tiposValidos = ['autorizacion_paterna', 'tarjeta_sanitaria'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DOCUMENT_TYPE',
          message: 'Invalid document type',
        },
      });
    }

    const jovenResult = await pool.query(
      `SELECT ja.joven_id
       FROM joven_accesos ja
       WHERE ja.token = $1`,
      [jovenToken]
    );

    if (!jovenResult.rows.length) {
      return notFoundResponse(res);
    }

    const jovenId = jovenResult.rows[0].joven_id;
    const rutaInterna = `${jovenId}/${req.file.filename}`;
    const mimeType = req.file.detectedMimeType || req.file.mimetype;

    const result = await pool.query(
      `INSERT INTO documentos (joven_id, tipo, ruta_interna, nombre_original, mime_type, tamaño_bytes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tipo, nombre_original, mime_type, subido_en`,
      [jovenId, tipo, rutaInterna, req.file.originalname, mimeType, req.file.size]
    );

    res.status(201).json({
      mensaje: 'Documento subido',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

const deleteFichaDocumento = async (req, res, next) => {
  try {
    const { jovenToken, docId } = req.params;

    if (!isValidUUID(jovenToken) || !isValidUUID(docId)) {
      return notFoundResponse(res);
    }

    const result = await pool.query(
      `DELETE FROM documentos d
       USING joven_accesos ja
       WHERE d.id = $1 AND d.joven_id = ja.joven_id AND ja.token = $2
       RETURNING d.id, d.ruta_interna`,
      [docId, jovenToken]
    );

    if (!result.rows.length) {
      return notFoundResponse(res);
    }

    const uploadsRoot = path.resolve(process.env.UPLOADS_PATH || '/data/uploads');
    const filePath = path.resolve(uploadsRoot, result.rows[0].ruta_interna);

    if (filePath !== uploadsRoot && filePath.startsWith(`${uploadsRoot}${path.sep}`) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ mensaje: 'Documento eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFicha,
  updateFicha,
  uploadFichaDocumento,
  deleteFichaDocumento,
};
