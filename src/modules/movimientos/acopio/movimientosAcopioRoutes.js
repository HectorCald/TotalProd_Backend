const express = require('express');
const router = express.Router();
const movimientosAcopioController = require('./movimientosAcopioController');
const { requireAuth } = require('../../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// 1. Obtener todos los movimientos
router.get('/', movimientosAcopioController.getAll);

// 2. Obtener todos los movimientos sin límite (para reportes y balance)
router.get('/sin-limite', movimientosAcopioController.getAllSinLimite);

// 3. Obtener un movimiento por ID
router.get('/:id', movimientosAcopioController.getById);

// 4. Crear un movimiento
router.post('/', movimientosAcopioController.create);

// 5. Eliminar un movimiento
router.delete('/:id', movimientosAcopioController.delete);

// 6. Anular un movimiento
router.put('/:id/anular', movimientosAcopioController.anular);

module.exports = router;
