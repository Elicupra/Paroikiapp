const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Todos los endpoints requieren autenticación de administrador
router.use(authMiddleware);
router.use(requireRole(['organizador', 'administrador']));

// Tipos de evento
router.get('/tipos-evento', adminController.getTiposEvento);
router.post('/tipos-evento', adminController.createTipoEvento);
router.patch('/tipos-evento/:tipoId', adminController.updateTipoEvento);
router.delete('/tipos-evento/:tipoId', adminController.deleteTipoEvento);

// GET /api/admin/registration-links
router.get('/registration-links', adminController.getRegistrationLinks);

// GET/PUT /api/admin/configuracion
router.get('/configuracion', adminController.getConfiguracion);
router.put('/configuracion', adminController.updateConfiguracion);

// GET /api/admin/dashboard
router.get('/dashboard', adminController.getAdminDashboard);

// GET /api/admin/eventos
router.get('/eventos', adminController.getEventos);

// POST /api/admin/eventos
router.post('/eventos', adminController.createEvento);

// GET /api/admin/eventos/:eventoId
router.get('/eventos/:eventoId', adminController.getEvento);

// PUT /api/admin/eventos/:eventoId
router.put('/eventos/:eventoId', adminController.updateEvento);

// PATCH /api/admin/eventos/:eventoId/descuento-global
router.patch('/eventos/:eventoId/descuento-global', adminController.updateEventoDescuentoGlobal);

// DELETE /api/admin/eventos/:eventoId
router.delete('/eventos/:eventoId', adminController.deleteEvento);

// GET /api/admin/eventos/:eventoId/jovenes
router.get('/eventos/:eventoId/jovenes', adminController.getEventoJovenes);

// GET /api/admin/eventos/:eventoId/recaudacion
router.get('/eventos/:eventoId/recaudacion', adminController.getEventoRecaudacionAdmin);

// GET /api/admin/usuarios
router.get('/usuarios', adminController.getUsuarios);

// GET /api/admin/usuarios/:usuarioId
router.get('/usuarios/:usuarioId', adminController.getUsuario);

// POST /api/admin/usuarios
router.post('/usuarios', adminController.createUsuario);

// PUT /api/admin/usuarios/:usuarioId
router.put('/usuarios/:usuarioId', adminController.updateUsuario);

// DELETE /api/admin/usuarios/:usuarioId
router.delete('/usuarios/:usuarioId', adminController.deleteUsuario);

// PATCH /api/admin/usuarios/:usuarioId/toggle-active
router.patch('/usuarios/:usuarioId/toggle-active', adminController.toggleUsuarioActivo);

// GET /api/admin/usuarios/:usuarioId/eventos
router.get('/usuarios/:usuarioId/eventos', adminController.getUsuarioEventos);

// Compatibilidad asignación de eventos por monitor
router.get('/monitores/:monitorId/eventos', adminController.getMonitorEventos);
router.post('/monitores/:monitorId/eventos', adminController.assignMonitorEventoByPath);
router.patch('/monitores/:monitorId/eventos/:eventoId', adminController.updateMonitorEventoAssignment);
router.delete('/monitores/:monitorId/eventos/:eventoId', adminController.removeMonitorEventoByEvento);
router.post('/monitores/:monitorId/eventos/:eventoId/revocar-enlace', adminController.revokeMonitorTokenByEvento);

// GET /api/admin/monitores/:monitorId/dashboard
router.get('/monitores/:monitorId/dashboard', adminController.getMonitorDashboard);

// GET /api/admin/monitores/:monitorId/ficheros
router.get('/monitores/:monitorId/ficheros', adminController.getMonitorFicherosAdmin);

// GET /api/admin/monitores/perfiles
router.get('/monitores/perfiles', adminController.getMonitoresPerfiles);

// GET/PATCH /api/admin/monitores/:monitorId/perfil
router.get('/monitores/:monitorId/perfil', adminController.getMonitorPerfilAdmin);
router.patch('/monitores/:monitorId/perfil', adminController.updateMonitorPerfilAdmin);

// Límite de jóvenes por monitor
router.patch('/monitores/:monitorId/max-jovenes', adminController.updateMonitorMaxJovenes);

// GET /api/admin/usuarios/:usuarioId/jovenes
router.get('/usuarios/:usuarioId/jovenes', adminController.getUsuarioJovenes);

// POST /api/admin/monitores
router.post('/monitores', adminController.assignMonitorEvento);

// DELETE /api/admin/monitores/:monitorId
router.delete('/monitores/:monitorId', adminController.removeMonitorEvento);

// DELETE /api/admin/monitores/:monitorId/token
router.delete('/monitores/:monitorId/token', adminController.revokeMonitorToken);

// GET /api/admin/jovenes
router.get('/jovenes', adminController.getJovenes);

// POST /api/admin/jovenes
router.post('/jovenes', adminController.createJovenAdmin);

// PATCH /api/admin/jovenes/:jovenId
router.patch('/jovenes/:jovenId', adminController.updateJovenAdmin);

// DELETE /api/admin/jovenes/:jovenId
router.delete('/jovenes/:jovenId', adminController.deleteJovenAdmin);

// GET /api/admin/jovenes/:jovenId/perfil
router.get('/jovenes/:jovenId/perfil', adminController.getJovenPerfilAdmin);

module.exports = router;
