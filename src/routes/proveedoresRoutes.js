const express = require('express');
const proveedoresController = require('../controllers/proveedoresController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Aplicar middleware de acceso al módulo 'Proveedores' a todas las rutas
router.use(requireModuleAccess('Proveedores'));

// Rutas para los proveedores
router.get('/', proveedoresController.getAll);
router.get('/:id', proveedoresController.getById);
router.post('/', proveedoresController.create);
router.put('/:id', proveedoresController.update);
router.delete('/:id', proveedoresController.delete);

module.exports = router;
