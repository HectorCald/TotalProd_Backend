require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Importar configuración de CORS y Supabase
const corsOptions = require('./config/cors');
const { testConnection } = require('./config/supabase');

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Importar rutas
const apiRoutes = require('./routes');

// Usar rutas
app.use('/api', apiRoutes);

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'TotalProd Backend API funcionando correctamente' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
if (process.env.NODE_ENV !== "production") {
  app.listen(5000, async () => {
    console.log("✅ Servidor local en http://localhost:5000");
    // Probar conexión a Supabase
    await testConnection();
  });
}

module.exports = app;
