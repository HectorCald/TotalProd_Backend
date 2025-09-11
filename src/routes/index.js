const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');
const passwordResetRoutes = require('./passwordResetRoutes');
const clientRoutes = require('./clientRoutes');
const proveedorRoutes = require('./proveedoresRoutes');
const productsAcopioRoutes = require('./productsAcopioRoutes');
const productsAlmacenRoutes = require('./productsAlmacenRoutes');
const typeMeasureRoutes = require('./typeMeasureRoutes');
const categoryAcopioRoutes = require('./categoryAcopioRoutes');
const categoryAlmacenRoutes = require('./categoryAlmacenRoutes');
const pricesTypesRoutes = require('./pricesTypesRoutes');
const movimientosAcopioRoutes = require('./movimientosAcopioRoutes');
const pedidosAcopioRoutes = require('./pedidosAcopioRoutes');
const planRoutes = require('./planRoutes');

// Ruta principal
router.get('/', (req, res) => {
  res.json({ 
    message: 'TotalProd Backend API funcionando correctamente',
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
router.use('/passwordReset', passwordResetRoutes);

// Rutas de clientes
router.use('/clients', clientRoutes);

// Rutas de proveedores
router.use('/proveedores', proveedorRoutes);

// Rutas de productos de acopio
router.use('/products-acopio', productsAcopioRoutes);

// Rutas de productos de almacén
router.use('/products-almacen', productsAlmacenRoutes);

// Rutas de tipos de medida
router.use('/type-measures', typeMeasureRoutes);

// Rutas de categorías de acopio
router.use('/category-acopio', categoryAcopioRoutes);

// Rutas de categorías de almacén
router.use('/category-almacen', categoryAlmacenRoutes);

// Rutas de tipos de precios
router.use('/prices-types', pricesTypesRoutes);

// Rutas de movimientos de acopio
router.use('/movimientos-acopio', movimientosAcopioRoutes);

// Rutas de pedidos de acopio
router.use('/pedidos-acopio', pedidosAcopioRoutes);


// Rutas de planes
router.use('/plans', planRoutes);

module.exports = router;
