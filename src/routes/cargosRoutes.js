const express = require('express');
const router = express.Router();
const cargosController = require('../controllers/cargosController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/cargos - Obtener todos los cargos
router.get('/', cargosController.getAll);

// POST /api/cargos - Crear un cargo
router.post('/', requireModuleAccess('Cargos'), cargosController.create);

// PUT /api/cargos/:id - Actualizar un cargo
router.put('/:id', requireModuleAccess('Cargos'), cargosController.update);

// DELETE /api/cargos/:id - Eliminar un cargo
router.delete('/:id', requireModuleAccess('Cargos'), cargosController.delete);

module.exports = router;
