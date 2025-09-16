const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursalesController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

router.use(requireAuth);

// Rutas que NO requieren módulo (solo lectura)
router.get('/empresa/:empresaId', sucursalesController.getByEmpresaId);
router.get('/:id', sucursalesController.getById);

// Rutas que SÍ requieren módulo (escritura)
router.post('/', requireModuleAccess('Sucursales'), sucursalesController.create);
router.put('/:id', requireModuleAccess('Sucursales'), sucursalesController.update);
router.delete('/:id', requireModuleAccess('Sucursales'), sucursalesController.delete);

module.exports = router;
