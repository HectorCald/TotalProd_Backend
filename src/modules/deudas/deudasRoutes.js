const express = require('express');
const deudasController = require('./deudasController');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Pagos parciales
router.get('/:id/pagos-parciales', deudasController.getPagosParciales);
router.post('/:id/pagos-parciales', deudasController.createPagoParcial);
router.delete('/:id/pagos-parciales/:pago_id', deudasController.deletePagoParcial);

// Rutas para las deudas
router.get('/sin-limite', deudasController.getAllSinLimite);
router.get('/', deudasController.getAll);
router.get('/:id', deudasController.getById);
router.post('/', deudasController.create);
router.put('/:id', deudasController.update);
router.put('/:id/estado', deudasController.updateEstado);

router.delete('/:id', deudasController.delete);

module.exports = router;
