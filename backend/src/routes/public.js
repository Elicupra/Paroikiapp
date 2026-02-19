const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// GET /api/public/eventos - Obtener eventos activos (sin autenticación)
router.get('/eventos', publicController.getEventosPublicos);

module.exports = router;
