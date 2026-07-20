const express = require('express');
const productsAcopioController = require('../controllers/productsAcopioController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Ruta para obtener todos los productos de acopio
router.get('/', productsAcopioController.getAll);

// Ruta para obtener productos para conteo
router.get('/conteo-data', productsAcopioController.getProductsForConteo);

// Ruta para obtener todos los productos para selector de receta (sin paginación)
router.get('/for-receta', productsAcopioController.getProductsForReceta);

// Ruta para obtener un producto de acopio por ID
router.get('/:id', productsAcopioController.getById);

// Ruta para obtener un producto de acopio por su categoría
router.get('/category/:categoryId', productsAcopioController.getByCategory);

// Ruta para verificar si un producto de acopio tiene movimientos
router.get('/:id/has-movements', productsAcopioController.hasMovements);

// Ruta para crear un producto de acopio
router.post('/', productsAcopioController.create);

// Ruta para actualizar un producto de acopio
router.put('/:id', productsAcopioController.update);

// Ruta para eliminar un producto de acopio
router.delete('/:id', productsAcopioController.delete);

module.exports = router;
