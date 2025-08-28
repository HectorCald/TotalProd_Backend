const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Importar rutas
const apiRoutes = require('./routes');

// Usar rutas
app.use('/api', apiRoutes);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Summa Backend API funcionando correctamente' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Servidor Summa Backend ejecutándose en puerto ${PORT}`);
  console.log(`📱 API disponible en: http://localhost:${PORT}`);
  console.log(`🔗 Endpoints de usuarios: http://localhost:${PORT}/api/users`);
});

module.exports = app;
