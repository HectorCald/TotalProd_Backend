const express = require('express');
const router = express.Router();
const transferenciasAlmacenController = require('../controllers/transferenciasAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Crear una nueva transferencia
router.post('/', transferenciasAlmacenController.create);

// Obtener todas las transferencias del usuario
router.get('/', transferenciasAlmacenController.getAll);

// Obtener una transferencia específica por ID
router.get('/:id', transferenciasAlmacenController.getById);

// Actualizar estado de una transferencia
router.patch('/:id/estado', transferenciasAlmacenController.actualizarEstado);

// Eliminar una transferencia
router.delete('/:id', transferenciasAlmacenController.eliminar);

module.exports = router;

