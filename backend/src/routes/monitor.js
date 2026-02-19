const express = require('express');
const router = express.Router();
const { authMiddleware, requireMonitorOrSimulated } = require('../middleware/auth');
const { validatePago } = require('../middleware/validators');
const monitorController = require('../controllers/monitorController');

// Todos los endpoints requieren autenticación de monitor o simulacion de organizador
router.use(authMiddleware);
router.use(requireMonitorOrSimulated);

// GET /api/monitor/registration-link
router.get('/registration-link', monitorController.getRegistrationLink);

// GET /api/monitor/jovenes
router.get('/jovenes', monitorController.getJovenes);

// GET /api/monitor/jovenes/:jovenId
router.get('/jovenes/:jovenId', monitorController.getJovenDetalle);

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

module.exports = router;
