const express = require('express');
const router = express.Router();
const categoryAlmacenController = require('./categoryAlmacenController');
const { requireAuth } = require('../../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

router.get('/', categoryAlmacenController.getAll);
router.post('/', categoryAlmacenController.create);
router.put('/:id', categoryAlmacenController.update);
router.delete('/:id', categoryAlmacenController.delete);

module.exports = router;
