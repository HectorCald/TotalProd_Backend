const express = require('express');
const router = express.Router();
const modulesController = require('../controllers/modulesController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Obtener todos los módulos con sus submódulos
router.get('/', modulesController.getAll);

// Obtener un módulo específico con sus submódulos
router.get('/:id', modulesController.getById);

module.exports = router;
