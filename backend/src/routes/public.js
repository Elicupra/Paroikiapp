const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const { contactLimiter } = require('../middleware/rateLimiters');

// GET /api/public/eventos - Obtener eventos activos (sin autenticación)
router.get('/eventos', publicController.getEventosPublicos);

// POST /api/public/contacto
router.post('/contacto', contactLimiter, publicController.submitContacto);

// GET /api/public/configuracion
router.get('/configuracion', publicController.getConfiguracionPublica);

module.exports = router;
