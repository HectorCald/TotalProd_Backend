const express = require('express');
const router = express.Router();
const pedidosAlmacenController = require('../controllers/pedidosAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas
router.post('/', pedidosAlmacenController.create);
router.post('/fast', pedidosAlmacenController.createFast);
router.get('/', pedidosAlmacenController.getAll);
router.get('/sin-limite', pedidosAlmacenController.getAllSinLimite);
router.get('/solicitantes-unicos', pedidosAlmacenController.getSolicitantesUnicos);
router.get('/resumen-mensual', pedidosAlmacenController.getResumenMensual);
router.get('/:id', pedidosAlmacenController.getById);
router.put('/:id', pedidosAlmacenController.update);
router.put('/:id/update-fast', pedidosAlmacenController.updateFast);
// router.put('/:id/entrega', pedidosAlmacenController.updateEntrega); // DEPRECATED - no se usa
// router.post('/:id/entregar', pedidosAlmacenController.entregarPedido); // DEPRECATED - no se usa
router.patch('/:id/estado', pedidosAlmacenController.updateEstado);
router.delete('/:id', pedidosAlmacenController.eliminar);
router.get('/verificar-producto/:productoId', pedidosAlmacenController.verificarProductoEnPedidos);

module.exports = router;
