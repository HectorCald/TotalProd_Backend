const express = require('express');
const router = express.Router();
const typeMeasureController = require('../controllers/typeMeasureController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/type-measures - Obtener todos los tipos de medida
router.get('/', typeMeasureController.getAll);

module.exports = router;
