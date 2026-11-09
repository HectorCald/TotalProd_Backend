const express = require('express');
const clientsController = require('./clientsController');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Rutas de geocodificación OpenStreetMap (antes de /:id)
router.get('/geocode/search', clientsController.geocodeSearch);
router.get('/geocode/reverse', clientsController.geocodeReverse);

// Rutas para los clientes
router.get('/', clientsController.getAll);
router.put('/bulk-update', clientsController.bulkUpdate);
router.patch('/:id/location', clientsController.updateLocation);
router.put('/:id/location', clientsController.updateLocation);
router.get('/:id', clientsController.getById);
router.post('/', clientsController.create);
router.put('/:id', clientsController.update);
router.delete('/:id', clientsController.delete);

module.exports = router;