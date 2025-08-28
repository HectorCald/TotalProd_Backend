const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');

// Ruta principal
router.get('/', (req, res) => {
  res.json({ 
    message: 'Summa Backend API funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Ruta de estado
router.get('/status', (req, res) => {
  res.json({ 
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Rutas de usuarios
router.use('/users', userRoutes);

module.exports = router;
