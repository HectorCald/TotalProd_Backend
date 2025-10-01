const express = require('express');
const router = express.Router();
const movimientosAlmacenController = require('../controllers/movimientosAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Crear un nuevo movimiento
router.post('/', movimientosAlmacenController.create);

// Obtener todos los movimientos del usuario
router.get('/', movimientosAlmacenController.getAll);

// Obtener movimientos por tipo (entrada/salida)
router.get('/tipo/:tipo', movimientosAlmacenController.getByType);

// Obtener movimientos por producto
router.get('/product/:productId', movimientosAlmacenController.getByProduct);

// Obtener un movimiento específico por ID
router.get('/:id', movimientosAlmacenController.getById);

// Actualizar un movimiento
router.put('/:id', movimientosAlmacenController.update);

// Ruta para anular un movimiento
router.put('/:id/anular', movimientosAlmacenController.anular);

// Ruta para eliminar un movimiento
router.delete('/:id', movimientosAlmacenController.eliminar);

module.exports = router;
