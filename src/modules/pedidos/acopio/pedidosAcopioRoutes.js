const express = require('express');
const router = express.Router();
const pedidosAcopioController = require('./pedidosAcopioController');
const { requireAuth } = require('../../../middleware/auth');

router.use(requireAuth);

router.get('/', pedidosAcopioController.getAll);
router.post('/', pedidosAcopioController.create);
router.delete('/:id', pedidosAcopioController.delete);
router.get('/:id', pedidosAcopioController.getById);
router.patch('/:id/estado', pedidosAcopioController.updateEstado);
router.post('/:id/entregar', pedidosAcopioController.entregar);
router.post('/:id/anular-entrega', pedidosAcopioController.anularEntrega);
router.get('/solicitantes-unicos', pedidosAcopioController.getSolicitantesUnicos);

module.exports = router;