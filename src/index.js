require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Importar configuración de CORS y Supabase
const corsOptions = require('./config/cors');
const { testConnection } = require('./config/supabase');

// Rutas de módulos
const userRoutes = require('./modules/auth/userRoutes');
const clientRoutes = require('./modules/clientes/clientRoutes');
const proveedorRoutes = require('./modules/proveedores/proveedoresRoutes');
const productsAcopioRoutes = require('./modules/productos/acopio/productsAcopioRoutes');
const productsAlmacenRoutes = require('./modules/productos/almacen/productsAlmacenRoutes');
const typeMeasureRoutes = require('./modules/otros/tipo-prima/typeMeasureRoutes');
const categoryAcopioRoutes = require('./modules/categorias/acopio/categoryAcopioRoutes');
const categoryAlmacenRoutes = require('./modules/categorias/almacen/categoryAlmacenRoutes');
const pricesTypesRoutes = require('./modules/precios/pricesTypesRoutes');
const movimientosAcopioRoutes = require('./modules/movimientos/acopio/movimientosAcopioRoutes');
const movimientosAlmacenRoutes = require('./modules/movimientos/almacen/movimientosAlmacenRoutes');
const pedidosAcopioRoutes = require('./modules/pedidos/acopio/pedidosAcopioRoutes');
const pedidosAlmacenRoutes = require('./modules/pedidos/almacen/pedidosAlmacenRoutes');
const modulesRoutes = require('./modules/otros/modulos/modulesRoutes');
const sucursalesRoutes = require('./modules/sucursales/sucursalesRoutes');
const personalRoutes = require('./modules/personal/personalRoutes');
const gastosRoutes = require('./modules/pagos/gastosRoutes');
const deudasRoutes = require('./modules/deudas/deudasRoutes');
const registrosProduccionDamabravaRoutes = require('./modules/custom/damabrava/produccion/registrosProduccionDamabravaRoutes');
const reglasProduccionDamabravaRoutes = require('./modules/custom/damabrava/reglas/reglasProduccionDamabravaRoutes');
const pagosDamabravaRoutes = require('./modules/custom/damabrava/pagos/pagosDamabravaRoutes');
const conteosRoutes = require('./modules/conteos/conteosRoutes');
const cotizacionesRoutes = require('./modules/cotizaciones/cotizacionesRoutes');
const empresaRoutes = require('./modules/empresa/empresaRoutes');
const cargosRoutes = require('./modules/cargos/cargosRoutes');

// Middleware
app.use(cors(corsOptions));
// Aumentar el límite de tamaño del body parser para aceptar imágenes base64 grandes (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Router de API (/api)
const apiRouter = express.Router();

// Ruta principal de API
apiRouter.get('/', (req, res) => {
  res.json({
    message: 'TotalProd Backend API funcionando correctamente',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Ruta de estado de API
apiRouter.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Rutas de módulos montadas en /api
apiRouter.use('/users', userRoutes);
apiRouter.use('/clients', clientRoutes);
apiRouter.use('/proveedores', proveedorRoutes);
apiRouter.use('/products-acopio', productsAcopioRoutes);
apiRouter.use('/products-almacen', productsAlmacenRoutes);
apiRouter.use('/type-measures', typeMeasureRoutes);
apiRouter.use('/category-acopio', categoryAcopioRoutes);
apiRouter.use('/category-almacen', categoryAlmacenRoutes);
apiRouter.use('/prices-types', pricesTypesRoutes);
apiRouter.use('/movimientos-acopio', movimientosAcopioRoutes);
apiRouter.use('/movimientos-almacen', movimientosAlmacenRoutes);
apiRouter.use('/pedidos-acopio', pedidosAcopioRoutes);
apiRouter.use('/pedidos-almacen', pedidosAlmacenRoutes);
apiRouter.use('/modules', modulesRoutes);
apiRouter.use('/sucursales', sucursalesRoutes);
apiRouter.use('/cargos', cargosRoutes);
apiRouter.use('/personal', personalRoutes);
apiRouter.use('/gastos', gastosRoutes);
apiRouter.use('/deudas', deudasRoutes);
apiRouter.use('/registros-produccion-damabrava', registrosProduccionDamabravaRoutes);
apiRouter.use('/reglas-produccion-damabrava', reglasProduccionDamabravaRoutes);
apiRouter.use('/pagos-damabrava', pagosDamabravaRoutes);
apiRouter.use('/conteos', conteosRoutes);
apiRouter.use('/cotizaciones', cotizacionesRoutes);
apiRouter.use('/empresas', empresaRoutes);

// Usar rutas API
app.use('/api', apiRouter);

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
  app.listen(PORT, () => {
    console.log(`✅ Servidor local en http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    // La conexión a Supabase se probará cuando se haga la primera petición
  });
}

module.exports = app;
