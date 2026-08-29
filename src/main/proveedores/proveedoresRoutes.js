const express = require('express');
const proveedoresController = require('./proveedoresController');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas para los proveedores
router.get('/', proveedoresController.getAll);
router.get('/:id', proveedoresController.getById);
router.post('/', proveedoresController.create);
router.put('/:id', proveedoresController.update);
router.delete('/:id', proveedoresController.delete);

module.exports = router;