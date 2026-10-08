const express = require('express');
const router = express.Router();
const cargosController = require('./cargosController');
const { requireAuth } = require('../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

router.get('/', cargosController.getAll);
router.post('/', cargosController.create);
router.put('/:id', cargosController.update);
router.delete('/:id', cargosController.delete);

module.exports = router;