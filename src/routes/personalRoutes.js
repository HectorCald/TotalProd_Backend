const express = require('express');
const PersonalController = require('../controllers/personalController');
const { requireAuth } = require('../middleware/auth');
const { requireModuleAccess } = require('../middleware/moduleAuth');

const router = express.Router();

// Rutas públicas para empleados (sin autenticación)
router.get('/validate-employee/:codigo', PersonalController.validateEmployeeCode);
router.post('/login-employee', PersonalController.loginEmployee);
router.post('/:id/set-password', PersonalController.setPassword);
router.post('/:id/change-password', PersonalController.changePassword); // Nueva ruta para cambiar contraseña

// Aplicar autenticación a las rutas restantes
router.use(requireAuth);

// Rutas que requieren autenticación pero NO verificación de módulo
router.post('/:id/reset-password', PersonalController.resetPassword);
router.post('/:id/update-location', PersonalController.updateLocation);
router.get('/:id/location', PersonalController.getLocation);

// Aplicar middleware de acceso al módulo 'Personal' a las rutas restantes
router.use(requireModuleAccess('Personal'));

// Rutas CRUD (autenticación + verificación de módulo requerida)
router.get('/', PersonalController.getAll);
router.get('/:id', PersonalController.getById);
router.post('/', PersonalController.create);
router.put('/:id', PersonalController.update);
router.delete('/:id', PersonalController.delete);

module.exports = router;
