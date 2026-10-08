const express = require('express');
const PersonalController = require('./personalController');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

// Rutas públicas para empleados (sin autenticación)
router.post('/:id/set-password', PersonalController.setPassword);

// Aplicar autenticación a las rutas restantes
router.use(requireAuth);

// Rutas que requieren autenticación
router.get('/', PersonalController.getAll);
router.get('/organigrama', PersonalController.getForOrganigrama);
router.get('/permissions/info', PersonalController.getInfoPermission);
router.get('/permissions/update', PersonalController.getUpdatePermission);
router.post('/', PersonalController.create);
router.put('/:id', PersonalController.update);
router.delete('/:id', PersonalController.delete);
router.get('/:id', PersonalController.getById);
router.post('/:id/reset-password', PersonalController.resetPassword);

module.exports = router;