const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');
const { validateJoven } = require('../middleware/validators');
const { uploadJovenDocumento, validateRealFileType } = require('../middleware/upload');

// GET /register/acceso/:accessToken
router.get('/acceso/:accessToken', registerController.getJovenAccessInfo);

// POST /register/acceso/:accessToken/documento
router.post('/acceso/:accessToken/documento', uploadJovenDocumento.single('archivo'), validateRealFileType, registerController.uploadDocumentByAccess);

// GET /register/:token
router.get('/:token', registerController.getEventoInfo);

// POST /register/:token/joven
router.post('/:token/joven', validateJoven, registerController.registerJoven);

// POST /register/:token/joven/:jovenId/documento
router.post('/:token/joven/:jovenId/documento', uploadJovenDocumento.single('archivo'), validateRealFileType, registerController.uploadDocument);

module.exports = router;
