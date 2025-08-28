const express = require('express');
const UserController = require('../controllers/userController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rutas para usuarios - IMPORTANTE: Las rutas específicas van ANTES que las dinámicas
router.get('/', UserController.getAllUsers);
router.get('/profile/:email', UserController.getUserProfile);
router.post('/login', UserController.login);
router.post('/create', UserController.createUser);
router.get('/:id', UserController.getUserById);

module.exports = router;
