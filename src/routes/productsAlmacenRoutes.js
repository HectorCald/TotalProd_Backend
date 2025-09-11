const express = require('express');
const router = express.Router();
const productsAlmacenController = require('../controllers/productsAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/products-almacen - Obtener todos los productos
router.get('/', productsAlmacenController.getAll);

// POST /api/products-almacen - Crear un producto
router.post('/', productsAlmacenController.create);

// PUT /api/products-almacen/:id - Actualizar un producto
router.put('/:id', productsAlmacenController.update);

// DELETE /api/products-almacen/:id - Eliminar un producto
router.delete('/:id', productsAlmacenController.delete);

module.exports = router;
