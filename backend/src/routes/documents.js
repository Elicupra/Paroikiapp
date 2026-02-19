const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const documentController = require('../controllers/documentController');

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

// GET /api/documentos/:docId
router.get('/:docId', documentController.getDocument);

module.exports = router;
