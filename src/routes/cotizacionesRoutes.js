const express = require('express');
const router = express.Router();
const cotizacionesController = require('../controllers/cotizacionesController');
const { requireAuth } = require('../middleware/auth');



// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);
// Obtener una cotización por ID
router.get('/:id', cotizacionesController.getById);


// Obtener todas las cotizaciones
router.get('/', cotizacionesController.getAll);

// Crear una nueva cotización rápida de golpe
router.post('/fast', cotizacionesController.createFast);

// Crear una nueva cotización
router.post('/', cotizacionesController.create);

// Actualizar estado de una cotización
router.put('/:id/estado', cotizacionesController.actualizarEstado);

// Eliminar una cotización
router.delete('/:id', cotizacionesController.eliminar);

module.exports = router;
