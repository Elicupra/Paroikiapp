const express = require('express');
const router = express.Router();
const fichaController = require('../controllers/fichaController');
const { uploadJovenDocumento, validateRealFileType } = require('../middleware/upload');

// GET /ficha/:jovenToken
router.get('/:jovenToken', fichaController.getFicha);

// PATCH /ficha/:jovenToken
router.patch('/:jovenToken', fichaController.updateFicha);

// POST /ficha/:jovenToken/documento
router.post('/:jovenToken/documento', uploadJovenDocumento.single('archivo'), validateRealFileType, fichaController.uploadFichaDocumento);

// DELETE /ficha/:jovenToken/documento/:docId
router.delete('/:jovenToken/documento/:docId', fichaController.deleteFichaDocumento);

module.exports = router;
