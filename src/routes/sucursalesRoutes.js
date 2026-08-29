const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursalesController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Rutas que NO requieren módulo (solo lectura)
router.get('/', sucursalesController.getAll);
router.get('/:id/precios', sucursalesController.getPreciosBySucursalId);
router.get('/:id', sucursalesController.getById);

// Rutas (escritura)
router.post('/', sucursalesController.create);
router.put('/:id', sucursalesController.update);
router.delete('/:id', sucursalesController.delete);

module.exports = router;
