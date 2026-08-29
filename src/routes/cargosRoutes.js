const express = require('express');
const router = express.Router();
const cargosController = require('../controllers/cargosController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/cargos - Obtener todos los cargos
router.get('/', cargosController.getAll);

// POST /api/cargos - Crear un cargo
router.post('/', cargosController.create);

// PUT /api/cargos/:id - Actualizar un cargo
router.put('/:id', cargosController.update);

// DELETE /api/cargos/:id - Eliminar un cargo
router.delete('/:id', cargosController.delete);

module.exports = router;
