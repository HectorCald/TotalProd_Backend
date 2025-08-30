const express = require('express');
const UserController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rutas para usuarios - IMPORTANTE: Las rutas específicas van ANTES que las dinámicas
router.post('/create', UserController.createUser);
router.post('/login', UserController.login);
router.post('/getUserByPhone', UserController.getUserByPhone); // Verificar si email existe

module.exports = router;
