const express = require('express');
const router = express.Router();
const registrosProduccionDamabravaController = require('../controllers/registrosProduccionDamabravaController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// Crear un nuevo registro de producción
router.post('/', registrosProduccionDamabravaController.create);

// Obtener todos los registros de producción
router.get('/', registrosProduccionDamabravaController.getAll);

// Obtener registros de producción del usuario actual
router.get('/my-production', registrosProduccionDamabravaController.getByUser);

// Obtener un registro de producción por ID
router.get('/:id', registrosProduccionDamabravaController.getById);

// Eliminar un registro de producción
router.delete('/:id', registrosProduccionDamabravaController.delete);

// Verificar un registro de producción
router.put('/:id/verify', registrosProduccionDamabravaController.verify);

// Anular verificación de un registro de producción
router.put('/:id/unverify', registrosProduccionDamabravaController.unverify);

// Actualizar cantidad ingresada de un registro de producción
router.put('/:id/ingresar', registrosProduccionDamabravaController.updateCantidadIngresada);

// Restar cantidad ingresada cuando se anula un movimiento de producción
router.put('/:id/restar-ingresada', registrosProduccionDamabravaController.restarCantidadIngresada);

module.exports = router;
