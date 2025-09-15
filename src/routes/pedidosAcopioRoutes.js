const express = require('express');
const router = express.Router();
const pedidosAcopioController = require('../controllers/pedidosAcopioController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', pedidosAcopioController.create);
router.get('/', pedidosAcopioController.getAll);
router.get('/:id', pedidosAcopioController.getById);
router.patch('/:id/estado', pedidosAcopioController.updateEstado);
router.get('/verificar-producto/:productoId', pedidosAcopioController.verificarProductoEnPedidos);

module.exports = router;