const express = require('express');
const router = express.Router();
const categoryAcopioController = require('../controllers/categoryAcopioController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/category-acopio - Obtener todas las categorías
router.get('/', categoryAcopioController.getAll);

// POST /api/category-acopio - Crear una categoría
router.post('/', categoryAcopioController.create);

// PUT /api/category-acopio/:id - Actualizar una categoría
router.put('/:id', categoryAcopioController.update);

// DELETE /api/category-acopio/:id - Eliminar una categoría
router.delete('/:id', categoryAcopioController.delete);

module.exports = router;
