const express = require('express');
const router = express.Router();
const pricesTypesController = require('./pricesTypesController');
const { requireAuth } = require('../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);


// Metodos de Rutas
router.get('/',pricesTypesController.getAll);
router.post('/', pricesTypesController.create);
router.put('/:id', pricesTypesController.update);
router.delete('/:id', pricesTypesController.delete);

module.exports = router;
