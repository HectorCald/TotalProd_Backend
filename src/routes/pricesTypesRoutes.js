const express = require('express');
const router = express.Router();
const pricesTypesController = require('../controllers/pricesTypesController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/prices-types - Obtener todos los tipos de precios
router.get('/', pricesTypesController.getAll);

// POST /api/prices-types - Crear un tipo de precio
router.post('/', pricesTypesController.create);

// PUT /api/prices-types/:id - Actualizar un tipo de precio
router.put('/:id', pricesTypesController.update);

// DELETE /api/prices-types/:id - Eliminar un tipo de precio
router.delete('/:id', pricesTypesController.delete);

module.exports = router;
