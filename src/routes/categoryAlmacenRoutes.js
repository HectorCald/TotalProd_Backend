const express = require('express');
const router = express.Router();
const categoryAlmacenController = require('../controllers/categoryAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/category-almacen - Obtener todas las categorías
router.get('/', categoryAlmacenController.getAll);

// POST /api/category-almacen - Crear una categoría
router.post('/', categoryAlmacenController.create);

// PUT /api/category-almacen/:id - Actualizar una categoría
router.put('/:id', categoryAlmacenController.update);

// DELETE /api/category-almacen/:id - Eliminar una categoría
router.delete('/:id', categoryAlmacenController.delete);

module.exports = router;
