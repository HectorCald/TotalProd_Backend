const express = require('express');
const router = express.Router();
const cotizacionesController = require('./cotizacionesController');
const { requireAuth } = require('../../middleware/auth');



// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

router.get('/', cotizacionesController.getAll);
router.post('/', cotizacionesController.create);
router.delete('/:id', cotizacionesController.delete);
router.get('/:id', cotizacionesController.getById);
router.put('/:id/estado', cotizacionesController.actualizarEstado);

module.exports = router;
