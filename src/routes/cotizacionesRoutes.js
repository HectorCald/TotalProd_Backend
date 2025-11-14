const express = require('express');
const router = express.Router();
const cotizacionesController = require('../controllers/cotizacionesController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');



// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);
// Obtener una cotización por ID
router.get('/:id', cotizacionesController.getById);
// Aplicar middleware de acceso al módulo 'Cotizaciones' a todas las rutas
router.use(requireModuleAccess('Cotizaciones'));


// Obtener todas las cotizaciones
router.get('/', cotizacionesController.getAll);

// Crear una nueva cotización
router.post('/', cotizacionesController.create);

// Actualizar estado de una cotización
router.put('/:id/estado', cotizacionesController.actualizarEstado);

// Eliminar una cotización
router.delete('/:id', cotizacionesController.eliminar);

module.exports = router;
