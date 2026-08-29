const express = require('express');
const clientsController = require('./clientsController');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas para los clientes
router.get('/', clientsController.getAll);
router.get('/:id', clientsController.getById);
router.post('/', clientsController.create);
router.put('/:id', clientsController.update);
router.delete('/:id', clientsController.delete);

module.exports = router;