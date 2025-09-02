const express = require('express');
const PasswordResetController = require('../controllers/passwordResetController');

const router = express.Router();

// Rutas para reset de contraseña
router.post('/request', PasswordResetController.requestReset); // Solicitar reset
router.post('/verify', PasswordResetController.verifyResetToken); // Verificar token
router.post('/reset', PasswordResetController.resetPassword); // Resetear contraseña

module.exports = router;
