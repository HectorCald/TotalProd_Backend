const express = require('express');
const router = express.Router();
const ConteosController = require('../controllers/conteosController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

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


