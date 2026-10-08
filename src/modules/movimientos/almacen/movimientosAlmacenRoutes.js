const express = require('express');
const router = express.Router();
const movimientosAlmacenController = require('./movimientosAlmacenController');
const { requireAuth } = require('../../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// 1. Obtener todos los movimientos de la sucursal
router.get('/', (req, res) => movimientosAlmacenController.getAll(req, res));

// 2. Obtener todos los movimientos sin límite (para reportes y balance)
router.get('/sin-limite', (req, res) => movimientosAlmacenController.getAllSinLimite(req, res));

// 3. Obtener un movimiento específico por ID
router.get('/:id', (req, res) => movimientosAlmacenController.getById(req, res));

// 4. Crear movimiento
router.post('/', (req, res) => movimientosAlmacenController.create(req, res));

// 5. Eliminar un movimiento
router.delete('/:id', (req, res) => movimientosAlmacenController.delete(req, res));

// 6. Anular un movimiento
router.put('/:id/anular', (req, res) => movimientosAlmacenController.anular(req, res));

// 7. Obtener relaciones de un movimiento
router.get('/:id/relations', (req, res) => movimientosAlmacenController.getRelations(req, res));

// 8. Obtener movimientos por producción Damabrava
router.get('/produccion-damabrava/:produccionId', (req, res) => movimientosAlmacenController.getByProduccionDamabrava(req, res));

module.exports = router;
