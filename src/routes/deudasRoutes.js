const express = require('express');
const deudasController = require('../controllers/deudasController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Aplicar middleware de acceso al módulo 'Deudas' a todas las rutas
router.use(requireModuleAccess('Deudas'));

// Rutas para las deudas
router.get('/', deudasController.getAll);
router.get('/sin-limite', deudasController.getAllSinLimite);
router.get('/por-fechas', deudasController.getByDateRange);
router.get('/vencidas', deudasController.getDeudasVencidas);
router.get('/:id', deudasController.getById);
router.post('/', deudasController.create);
router.put('/:id', deudasController.update);
router.put('/:id/estado', deudasController.updateEstado);
// Importante: colocar esta ruta ANTES de '/:id' para evitar colisiones
router.delete('/movimiento/:movimiento_salida_id', deudasController.deleteByMovimientoSalidaId);
router.delete('/:id', deudasController.delete);

module.exports = router;
