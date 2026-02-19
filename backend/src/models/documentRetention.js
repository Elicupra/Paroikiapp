const fs = require('fs');
const path = require('path');
const pool = require('./db');

const RETENTION_DAYS = 7;

async function removeFileSafe(filePath) {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      return true;
    }
    console.warn('Retention: error deleting file', filePath, err.message);
    return false;
  }
}

async function cleanupExpiredDocuments() {
  const uploadsBase = process.env.UPLOADS_PATH || '/data/uploads';

  const docsResult = await pool.query(
    `SELECT d.id, d.ruta_interna
     FROM documentos d
     JOIN jovenes j ON j.id = d.joven_id
     JOIN eventos e ON e.id = j.evento_id
     WHERE e.fecha_fin IS NOT NULL
       AND e.fecha_fin < (CURRENT_DATE - ($1::int * INTERVAL '1 day'))`,
    [RETENTION_DAYS]
  );

  if (!docsResult.rows.length) {
    return { deleted: 0, candidates: 0 };
  }

  const idsToDelete = [];

  for (const doc of docsResult.rows) {
    const fullPath = path.join(uploadsBase, doc.ruta_interna);
    const removed = await removeFileSafe(fullPath);
    if (removed) {
      idsToDelete.push(doc.id);
    }
  }

  if (idsToDelete.length) {
    await pool.query('DELETE FROM documentos WHERE id = ANY($1::uuid[])', [idsToDelete]);
  }

  return { deleted: idsToDelete.length, candidates: docsResult.rows.length };
}

function startDocumentRetentionJob() {
  cleanupExpiredDocuments()
    .then((result) => {
      if (result.deleted > 0) {
        console.log(`Retention: deleted ${result.deleted}/${result.candidates} expired documents`);
      }
    })
    .catch((err) => {
      console.error('Retention: initial cleanup failed', err.message);
    });

  setInterval(async () => {
    try {
      const result = await cleanupExpiredDocuments();
      if (result.deleted > 0) {
        console.log(`Retention: deleted ${result.deleted}/${result.candidates} expired documents`);
      }
    } catch (err) {
      console.error('Retention: scheduled cleanup failed', err.message);
    }
  }, 12 * 60 * 60 * 1000);
}

module.exports = {
  cleanupExpiredDocuments,
  startDocumentRetentionJob,
};
