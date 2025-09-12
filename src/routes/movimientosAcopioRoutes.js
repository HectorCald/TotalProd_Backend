const express = require('express');
const router = express.Router();
const movimientosAcopioController = require('../controllers/movimientosAcopioController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Ruta para crear un movimiento
router.post('/', movimientosAcopioController.create);

// Ruta para obtener movimientos por producto
router.get('/product/:productId', movimientosAcopioController.getByProduct);

// Ruta para obtener movimientos por cliente
router.get('/cliente/:clienteId', movimientosAcopioController.getByCliente);

// Ruta para obtener movimientos por proveedor
router.get('/proveedor/:proveedorId', movimientosAcopioController.getByProveedor);

// Ruta para obtener todos los movimientos
router.get('/', movimientosAcopioController.getAll);

// Ruta para anular un movimiento
router.put('/:id/anular', movimientosAcopioController.anular);

// Ruta para eliminar un movimiento
router.delete('/:id', movimientosAcopioController.eliminar);

module.exports = router;
