const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { validatePago } = require('../middleware/validators');
const monitorController = require('../controllers/monitorController');

// Todos los endpoints requieren autenticación de monitor
router.use(authMiddleware);
router.use(requireRole(['monitor']));

// GET /api/monitor/registration-link
router.get('/registration-link', monitorController.getRegistrationLink);

// GET /api/monitor/jovenes
router.get('/jovenes', monitorController.getJovenes);

// GET /api/monitor/jovenes/:jovenId
router.get('/jovenes/:jovenId', monitorController.getJovenDetalle);

// POST /api/monitor/pagos
router.post('/pagos', validatePago, monitorController.createPago);

// PATCH /api/monitor/pagos/:pagoId
router.patch('/pagos/:pagoId', monitorController.updatePago);

module.exports = router;
