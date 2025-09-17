const express = require('express');
const router = express.Router();
const pedidosAlmacenController = require('../controllers/pedidosAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas
router.post('/', pedidosAlmacenController.create);
router.get('/', pedidosAlmacenController.getAll);
router.get('/:id', pedidosAlmacenController.getById);
router.put('/:id', pedidosAlmacenController.update);
router.patch('/:id/estado', pedidosAlmacenController.updateEstado);
router.delete('/:id', pedidosAlmacenController.eliminar);
router.get('/verificar-producto/:productoId', pedidosAlmacenController.verificarProductoEnPedidos);

module.exports = router;
