const express = require('express');
const router = express.Router();
const planificadorController = require('../controllers/planificadorController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/planificador - Obtener todas las tareas
router.get('/', planificadorController.getAll);

// GET /api/planificador/estado/:estado - Obtener por estado
router.get('/estado/:estado', planificadorController.getByEstado);

// GET /api/planificador/responsable/:id/estado/:estado - Obtener por responsable y estado
router.get('/responsable/:id/estado/:estado', planificadorController.getByIdEstado);

// GET /api/planificador/getByIdEstado - Obtener por responsable y estado vía query params
router.get('/getByIdEstado', planificadorController.getByIdEstado);

// GET /api/planificador/:id - Obtener tarea por ID
router.get('/:id', planificadorController.getById);

// POST /api/planificador - Crear tarea
router.post('/', planificadorController.create);

// PUT /api/planificador/:id - Actualizar tarea completa
router.put('/:id', planificadorController.update);

// PATCH /api/planificador/:id/estado - Actualizar solo estado
router.patch('/:id/estado', planificadorController.updateEstado);

// DELETE /api/planificador/:id - Eliminar tarea
router.delete('/:id', planificadorController.delete);

module.exports = router;
