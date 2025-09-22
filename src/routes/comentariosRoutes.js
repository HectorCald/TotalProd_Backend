const express = require('express');
const router = express.Router();
const comentariosController = require('../controllers/comentariosController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

// GET /api/comentarios - Obtener todos los comentarios
router.get('/', comentariosController.getAll);

// POST /api/comentarios - Crear un comentario
router.post('/', comentariosController.create);

// POST /api/comentarios/apoyo - Crear un apoyo a un comentario
router.post('/apoyo', comentariosController.createApoyo);

module.exports = router;
