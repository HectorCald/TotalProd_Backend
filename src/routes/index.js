const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes');
const clientRoutes = require('../main/clientes/clientRoutes');
const proveedorRoutes = require('../main/proveedores/proveedoresRoutes');
const productsAcopioRoutes = require('./productsAcopioRoutes');
const productsAlmacenRoutes = require('./productsAlmacenRoutes');
const typeMeasureRoutes = require('./typeMeasureRoutes');
const categoryAcopioRoutes = require('../main/categorias/acopio/categoryAcopioRoutes');
const categoryAlmacenRoutes = require('../main/categorias/almacen/categoryAlmacenRoutes');
const pricesTypesRoutes = require('../main/precios/pricesTypesRoutes');
const movimientosAcopioRoutes = require('./movimientosAcopioRoutes');
const movimientosAlmacenRoutes = require('./movimientosAlmacenRoutes');
const pedidosAcopioRoutes = require('./pedidosAcopioRoutes');
const pedidosAlmacenRoutes = require('./pedidosAlmacenRoutes');
const modulesRoutes = require('./modulesRoutes');
const sucursalesRoutes = require('../main/sucursales/sucursalesRoutes');
const personalRoutes = require('../main/personal/personalRoutes');
const gastosRoutes = require('../main/pagos/gastosRoutes');
const deudasRoutes = require('../main/deudas/deudasRoutes');
const registrosProduccionDamabravaRoutes = require('./registrosProduccionDamabravaRoutes');
const reglasProduccionDamabravaRoutes = require('./reglasProduccionDamabravaRoutes');
const pagosDamabravaRoutes = require('./pagosDamabravaRoutes');
const permissionsRoutes = require('./permissionsRoutes');
const conteosRoutes = require('../main/conteos/conteosRoutes');
const cotizacionesRoutes = require('../main/cotizaciones/cotizacionesRoutes');
const empresaRoutes = require('../main/empresa/empresaRoutes');
const cargosRoutes = require('../main/cargos/cargosRoutes');
const planificadorRoutes = require('./planificadorRoutes');

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

// Rutas de movimientos de almacén
router.use('/movimientos-almacen', movimientosAlmacenRoutes);

// Rutas de pedidos de acopio
router.use('/pedidos-acopio', pedidosAcopioRoutes);

// Rutas de pedidos de almacén
router.use('/pedidos-almacen', pedidosAlmacenRoutes);

// Rutas de módulos
router.use('/modules', modulesRoutes);

// Rutas de sucursales
router.use('/sucursales', sucursalesRoutes);

// Rutas de cargos
router.use('/cargos', cargosRoutes);

// Rutas de personal
router.use('/personal', personalRoutes);


// Rutas de gastos
router.use('/gastos', gastosRoutes);

// Rutas de deudas
router.use('/deudas', deudasRoutes);

// Rutas de registros de producción Damabrava
router.use('/registros-produccion-damabrava', registrosProduccionDamabravaRoutes);

// Rutas de reglas de producción Damabrava
router.use('/reglas-produccion-damabrava', reglasProduccionDamabravaRoutes);
// Rutas de pagos Damabrava
router.use('/pagos-damabrava', pagosDamabravaRoutes);
router.use('/permissions', permissionsRoutes);

// Rutas de conteos
router.use('/conteos', conteosRoutes);

// Rutas de cotizaciones
router.use('/cotizaciones', cotizacionesRoutes);


// Rutas de empresa
router.use('/empresas', empresaRoutes);

// Rutas del planificador de tareas
router.use('/planificador', planificadorRoutes);

module.exports = router;
