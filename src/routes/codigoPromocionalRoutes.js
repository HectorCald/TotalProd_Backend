const express = require('express');
const codigoPromocionalController = require('../controllers/codigoPromocionalController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Validar código promocional
router.post('/validar', codigoPromocionalController.validarCodigo);

// Aplicar código promocional
router.post('/aplicar', codigoPromocionalController.aplicarCodigo);

// Obtener todos los códigos (para administradores)
router.get('/', codigoPromocionalController.getAll);

// Crear código promocional (para administradores)
router.post('/', codigoPromocionalController.create);

module.exports = router;
