const express = require('express');
const router = express.Router();
const movimientosAlmacenController = require('../controllers/movimientosAlmacenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Crear un nuevo movimiento
router.post('/', (req, res) => movimientosAlmacenController.create(req, res));

// Crear un nuevo movimiento rápido
router.post('/fast', (req, res) => movimientosAlmacenController.createFast(req, res));

// Obtener todos los movimientos del usuario
router.get('/', (req, res) => movimientosAlmacenController.getAll(req, res));

// Obtener estadísticas optimizadas para gráficos
router.get('/stats/charts', (req, res) => movimientosAlmacenController.getStatsForCharts(req, res));

// Obtener movimientos por tipo (entrada/salida)
router.get('/tipo/:tipo', (req, res) => movimientosAlmacenController.getByType(req, res));

// Verificar si un producto tiene movimientos (ULTRA OPTIMIZADO)
router.get('/product/:productId/has-movements', (req, res) => movimientosAlmacenController.hasMovements(req, res));

// Obtener movimientos por producto
router.get('/product/:productId', (req, res) => movimientosAlmacenController.getByProduct(req, res));

// Obtener movimientos por cliente
router.get('/cliente/:clienteId', (req, res) => movimientosAlmacenController.getByCliente(req, res));

// Obtener movimientos por producción Damabrava
router.get('/produccion-damabrava/:produccionId', (req, res) => movimientosAlmacenController.getByProduccionDamabrava(req, res));

// Obtener un movimiento específico por ID
router.get('/:id', (req, res) => movimientosAlmacenController.getById(req, res));

// Actualizar un movimiento
router.put('/:id', (req, res) => movimientosAlmacenController.update(req, res));

// Ruta para anular un movimiento
router.put('/:id/anular', (req, res) => movimientosAlmacenController.anular(req, res));

// Ruta para anular un movimiento rápido de golpe
router.put('/:id/anular-fast', (req, res) => movimientosAlmacenController.anularFast(req, res));

// Ruta para eliminar un movimiento
router.delete('/:id', (req, res) => movimientosAlmacenController.eliminar(req, res));

// Rutas para manejar productos de movimientos
router.delete('/:id/productos', (req, res) => movimientosAlmacenController.deleteProductos(req, res));
router.post('/:id/productos', (req, res) => movimientosAlmacenController.createProductos(req, res));

module.exports = router;
