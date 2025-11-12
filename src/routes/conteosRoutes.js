const express = require('express');
const router = express.Router();
const ConteosController = require('../controllers/conteosController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');
// Obtener detalles de un conteo específico
router.get('/:id/detalles', ConteosController.getDetalles);

router.use(requireAuth);

// Aplicar middleware de acceso al módulo 'Conteos' a todas las rutas
router.use(requireModuleAccess('Conteos'));

// Crear un nuevo conteo
router.post('/', ConteosController.create);

// Obtener todos los conteos (sin paginación)
router.get('/', ConteosController.getAll);



// Reemplazar stock según conteo (almacén)
router.post('/:id/replace', ConteosController.replaceStock);

// Reemplazar stock según conteo (acopio)
router.post('/:id/replace-acopio', ConteosController.replaceStockAcopio);

// Eliminar un conteo
router.delete('/:id', ConteosController.delete);

module.exports = router;


