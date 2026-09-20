const express = require('express');
const router = express.Router();
const pedidosAlmacenController = require('./pedidosAlmacenController');
const { requireAuth } = require('../../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

router.get('/', pedidosAlmacenController.getAll);
router.post('/', pedidosAlmacenController.create);
router.put('/:id', pedidosAlmacenController.update);
router.delete('/:id', pedidosAlmacenController.delete);
router.get('/:id', pedidosAlmacenController.getById);
router.get('/solicitantes-unicos', pedidosAlmacenController.getSolicitantesUnicos);
router.patch('/:id/estado', pedidosAlmacenController.updateEstado);

module.exports = router;