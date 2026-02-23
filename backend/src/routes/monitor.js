const express = require('express');
const router = express.Router();
const { authMiddleware, requireMonitorOrSimulated } = require('../middleware/auth');
const { validatePago } = require('../middleware/validators');
const { uploadMonitorFichero, validateRealFileType } = require('../middleware/upload');
const monitorController = require('../controllers/monitorController');

// Todos los endpoints requieren autenticación de monitor o simulacion de organizador
router.use(authMiddleware);
router.use(requireMonitorOrSimulated);

// GET /api/monitor/registration-link
router.get('/registration-link', monitorController.getRegistrationLink);

// GET /api/monitor/eventos
router.get('/eventos', monitorController.getEventosMonitor);

// GET /api/monitor/eventos/:eventoId/recaudacion
router.get('/eventos/:eventoId/recaudacion', monitorController.getEventoRecaudacionMonitor);

// GET /api/monitor/jovenes
router.get('/jovenes', monitorController.getJovenes);

// GET /api/monitor/jovenes/:jovenId
router.get('/jovenes/:jovenId', monitorController.getJovenDetalle);

// PATCH /api/monitor/jovenes/:jovenId
router.patch('/jovenes/:jovenId', monitorController.updateJoven);

// GET /api/monitor/jovenes/:jovenId/documentos
router.get('/jovenes/:jovenId/documentos', monitorController.getJovenDocumentos);

// PATCH /api/monitor/documentos/:docId/validar
router.patch('/documentos/:docId/validar', monitorController.validarDocumento);

// GET /api/monitor/resumen?evento_id=<id>
router.get('/resumen', monitorController.getResumenEvento);

// POST /api/monitor/pagos
router.post('/pagos', validatePago, monitorController.createPago);

// PATCH /api/monitor/pagos/:pagoId
router.patch('/pagos/:pagoId', monitorController.updatePago);

// GET /api/monitor/ficheros
router.get('/ficheros', monitorController.getMonitorFicheros);

// POST /api/monitor/ficheros
router.post('/ficheros', uploadMonitorFichero.single('archivo'), validateRealFileType, monitorController.uploadMonitorFichero);

// DELETE /api/monitor/ficheros/:ficheroId
router.delete('/ficheros/:ficheroId', monitorController.deleteMonitorFichero);

module.exports = router;
