const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Todos los endpoints requieren autenticación de organizador
router.use(authMiddleware);
router.use(requireRole(['organizador']));

// GET /api/admin/registration-links
router.get('/registration-links', adminController.getRegistrationLinks);

// GET /api/admin/eventos
router.get('/eventos', adminController.getEventos);

// POST /api/admin/eventos
router.post('/eventos', adminController.createEvento);

// GET /api/admin/eventos/:eventoId
router.get('/eventos/:eventoId', adminController.getEvento);

// PUT /api/admin/eventos/:eventoId
router.put('/eventos/:eventoId', adminController.updateEvento);

// DELETE /api/admin/eventos/:eventoId
router.delete('/eventos/:eventoId', adminController.deleteEvento);

// GET /api/admin/eventos/:eventoId/jovenes
router.get('/eventos/:eventoId/jovenes', adminController.getEventoJovenes);

// GET /api/admin/usuarios
router.get('/usuarios', adminController.getUsuarios);

// GET /api/admin/usuarios/:usuarioId
router.get('/usuarios/:usuarioId', adminController.getUsuario);

// POST /api/admin/usuarios
router.post('/usuarios', adminController.createUsuario);

// PUT /api/admin/usuarios/:usuarioId
router.put('/usuarios/:usuarioId', adminController.updateUsuario);

// PATCH /api/admin/usuarios/:usuarioId/toggle-active
router.patch('/usuarios/:usuarioId/toggle-active', adminController.toggleUsuarioActivo);

// GET /api/admin/usuarios/:usuarioId/eventos
router.get('/usuarios/:usuarioId/eventos', adminController.getUsuarioEventos);

// POST /api/admin/monitores
router.post('/monitores', adminController.assignMonitorEvento);

// DELETE /api/admin/monitores/:monitorId
router.delete('/monitores/:monitorId', adminController.removeMonitorEvento);

// DELETE /api/admin/monitores/:monitorId/token
router.delete('/monitores/:monitorId/token', adminController.revokeMonitorToken);

// GET /api/admin/jovenes
router.get('/jovenes', adminController.getJovenes);

module.exports = router;
