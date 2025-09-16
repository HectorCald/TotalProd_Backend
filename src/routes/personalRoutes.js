const express = require('express');
const PersonalController = require('../controllers/personalController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rutas públicas para empleados (sin autenticación)
router.get('/validate-employee/:codigo', PersonalController.validateEmployeeCode);
router.post('/login-employee', PersonalController.loginEmployee);
router.post('/:id/set-password', PersonalController.setPassword);
router.post('/:id/change-password', PersonalController.changePassword); // Nueva ruta para cambiar contraseña

// Aplicar autenticación a las rutas restantes
router.use(requireAuth);

// Rutas CRUD (solo autenticación requerida)
router.get('/check/codigo', PersonalController.checkCodigo);
router.get('/', PersonalController.getAll);
router.get('/:id', PersonalController.getById);
router.post('/', PersonalController.create);
router.put('/:id', PersonalController.update);
router.delete('/:id', PersonalController.delete);

module.exports = router;
