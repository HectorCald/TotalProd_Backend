const express = require('express');
const router = express.Router();
const productsAlmacenController = require('../controllers/productsAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/products-almacen - Obtener todos los productos
router.get('/', productsAlmacenController.getAll);

// GET /api/products-almacen/for-production - Obtener productos ligeros (solo id y name) para formularios de producción
router.get('/for-production', productsAlmacenController.getAllForProduction);

// GET /api/products-almacen/conteo-data - Obtener productos para conteo
router.get('/conteo-data', productsAlmacenController.getProductsForConteo);

// GET /api/products-almacen/by-ids - Obtener múltiples productos por IDs con recetas
router.get('/by-ids', productsAlmacenController.getByIds);

// GET /api/products-almacen/by-ids-fast - Obtener múltiples productos por IDs de forma rápida
router.get('/by-ids-fast', productsAlmacenController.getByIdsFast);

// GET /api/products-almacen/:id - Obtener un producto por ID
router.get('/:id', productsAlmacenController.getById);

// POST /api/products-almacen - Crear un producto
router.post('/', productsAlmacenController.create);

// PUT /api/products-almacen/bulk-update - Actualizar múltiples productos en lote
router.put('/bulk-update', productsAlmacenController.bulkUpdate);

// POST /api/products-almacen/bulk-create - Crear múltiples productos en lote
router.post('/bulk-create', productsAlmacenController.bulkCreate);

// PUT /api/products-almacen/:id - Actualizar un producto
router.put('/:id', productsAlmacenController.update);

// DELETE /api/products-almacen/:id - Eliminar un producto
router.delete('/:id', productsAlmacenController.delete);

module.exports = router;
