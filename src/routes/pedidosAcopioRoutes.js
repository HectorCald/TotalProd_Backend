const express = require('express');
const router = express.Router();
const pedidosAcopioController = require('../controllers/pedidosAcopioController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas
router.post('/', pedidosAcopioController.create);
router.get('/', pedidosAcopioController.getAll);
router.get('/:id', pedidosAcopioController.getById);
router.patch('/:id/estado', pedidosAcopioController.updateEstado);

module.exports = router;
