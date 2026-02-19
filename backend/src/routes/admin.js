const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Todos los endpoints requieren autenticación de organizador
router.use(authMiddleware);
router.use(requireRole(['organizador']));

// GET /api/admin/eventos
router.get('/eventos', adminController.getEventos);

// POST /api/admin/eventos
router.post('/eventos', adminController.createEvento);

// GET /api/admin/eventos/:eventoId/jovenes
router.get('/eventos/:eventoId/jovenes', adminController.getEventoJovenes);

// GET /api/admin/usuarios
router.get('/usuarios', adminController.getUsuarios);

// POST /api/admin/usuarios
router.post('/usuarios', adminController.createUsuario);

// DELETE /api/admin/monitores/:monitorId/token
router.delete('/monitores/:monitorId/token', adminController.revokeMonitorToken);

module.exports = router;
