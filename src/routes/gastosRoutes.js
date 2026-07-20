const express = require('express');
const gastosController = require('../controllers/gastosController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Aplicar middleware de acceso al módulo 'Gastos' a todas las rutas
router.use(requireModuleAccess('Gastos'));

// Rutas para los gastos
router.get('/sin-limite', gastosController.getAllSinLimite);
router.get('/', gastosController.getAll);
router.get('/por-fechas', gastosController.getByDateRange);
router.get('/:id', gastosController.getById);
router.post('/', gastosController.create);
router.put('/:id', gastosController.update);
router.delete('/:id', gastosController.delete);

module.exports = router;
