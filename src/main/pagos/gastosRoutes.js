const express = require('express');
const gastosController = require('./gastosController');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas para los gastos
router.get('/sin-limite', gastosController.getAllSinLimite);
router.get('/', gastosController.getAll);
router.post('/', gastosController.create);
router.put('/:id', gastosController.update);
router.delete('/:id', gastosController.delete);
router.get('/:id', gastosController.getById);

module.exports = router;
