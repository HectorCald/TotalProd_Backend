const express = require('express');
const router = express.Router();
const movimientosAcopioController = require('../controllers/movimientosAcopioController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas
router.post('/', movimientosAcopioController.create);
router.get('/product/:productId', movimientosAcopioController.getByProduct);
router.get('/cliente/:clienteId', movimientosAcopioController.getByCliente);
router.get('/proveedor/:proveedorId', movimientosAcopioController.getByProveedor);
router.get('/', movimientosAcopioController.getAll);

module.exports = router;
