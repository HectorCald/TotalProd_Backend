const express = require('express');
const UserController = require('../controllers/userController');

const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rutas para usuarios - IMPORTANTE: Las rutas específicas van ANTES que las dinámicas
router.post('/create', UserController.createUser);
router.post('/login', UserController.login);
router.post('/getUserByEmail', UserController.getUserByEmail); // Verificar si email existe
router.post('/verifyPassword', UserController.verifyCurrentPassword); // Verificar contraseña actual
router.post('/changePassword', UserController.changePassword); // Cambiar contraseña
router.post('/encuesta-ia', UserController.enviarEncuestaIA); // Enviar encuesta de IA
router.get('/:id', UserController.getCurrentUser); // Obtener usuario por ID
router.put('/config', requireAuth, UserController.updateConfig); // Actualizar configuracion usuario y empresa

module.exports = router;
