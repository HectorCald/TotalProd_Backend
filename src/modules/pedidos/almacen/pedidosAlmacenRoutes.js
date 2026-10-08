const express = require('express');
const router = express.Router();
const pedidosAlmacenController = require('./pedidosAlmacenController');
const { requireAuth } = require('../../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

router.get('/', pedidosAlmacenController.getAll);
router.post('/', pedidosAlmacenController.create);
router.get('/solicitantes-unicos', pedidosAlmacenController.getSolicitantesUnicos);
router.get('/:id/productos', pedidosAlmacenController.getProductos);
router.get('/:id', pedidosAlmacenController.getById);
router.put('/:id', pedidosAlmacenController.update);
router.delete('/:id', pedidosAlmacenController.delete);
router.patch('/:id/estado', pedidosAlmacenController.updateEstado);

module.exports = router;