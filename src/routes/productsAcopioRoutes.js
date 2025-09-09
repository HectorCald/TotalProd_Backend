const express = require('express');
const productsAcopioController = require('../controllers/productsAcopioController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Aplicar middleware de acceso al módulo 'Acopio' a todas las rutas


// Rutas para los productos de acopio
router.get('/', productsAcopioController.getAll);
router.get('/category/:categoryId', productsAcopioController.getByCategory);
router.get('/:id/has-movements', productsAcopioController.hasMovements);
router.get('/:id', productsAcopioController.getById);
router.post('/', productsAcopioController.create);
router.put('/:id', productsAcopioController.update);
router.delete('/:id', productsAcopioController.delete);

module.exports = router;
