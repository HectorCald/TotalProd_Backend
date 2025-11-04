const express = require('express');
const router = express.Router();
const EmpresaController = require('../controllers/empresaController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Actualizar tipo de empresa
router.put('/tipo', EmpresaController.updateTipo);

// Obtener empresa por ID
router.get('/:id', EmpresaController.getById);

module.exports = router;

