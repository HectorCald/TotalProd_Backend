const express = require('express');
const router = express.Router();
const pedidosAcopioController = require('../controllers/pedidosAcopioController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', pedidosAcopioController.create);
router.get('/', pedidosAcopioController.getAll);
router.get('/solicitantes-unicos', pedidosAcopioController.getSolicitantesUnicos);
router.get('/:id', pedidosAcopioController.getById);
router.patch('/:id/estado', pedidosAcopioController.updateEstado);
router.post('/:id/entregar', pedidosAcopioController.entregar);
router.post('/:id/anular-entrega', pedidosAcopioController.anularEntrega);
router.delete('/:id', pedidosAcopioController.eliminar);
router.get('/verificar-producto/:productoId', pedidosAcopioController.verificarProductoEnPedidos);

module.exports = router;