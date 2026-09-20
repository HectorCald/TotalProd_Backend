const express = require('express');
const router = express.Router();
const categoryAcopioController = require('./categoryAcopioController');
const { requireAuth } = require('../../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

router.get('/', categoryAcopioController.getAll);
router.post('/', categoryAcopioController.create);
router.put('/:id', categoryAcopioController.update);
router.delete('/:id', categoryAcopioController.delete);

module.exports = router;
