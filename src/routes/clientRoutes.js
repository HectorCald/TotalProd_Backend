const express = require('express');
const clientsController = require('../controllers/clientsController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

const router = express.Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Aplicar middleware de acceso al módulo 'Clientes' a todas las rutas
router.use(requireModuleAccess('Clientes'));

// Rutas para los clientes
router.get('/', clientsController.getAll);
router.post('/', clientsController.create);
router.put('/:id', clientsController.update);
router.delete('/:id', clientsController.delete);

module.exports = router;
