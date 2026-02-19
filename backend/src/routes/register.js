const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');
const { validateJoven } = require('../middleware/validators');

// GET /register/:token
router.get('/:token', registerController.getEventoInfo);

// POST /register/:token/joven
router.post('/:token/joven', validateJoven, registerController.registerJoven);

// POST /register/:token/joven/:jovenId/documento
// Este endpoint se implementará con multer en un paso posterior

module.exports = router;
