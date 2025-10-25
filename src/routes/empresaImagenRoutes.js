const express = require('express');
const router = express.Router();
const EmpresaImagenController = require('../controllers/empresaImagenController');
const { requireAuth } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

/**
 * @route POST /api/empresa-imagen
 * @desc Crear nueva imagen de empresa
 * @access Private
 */
router.post('/', EmpresaImagenController.create);

/**
 * @route GET /api/empresa-imagen
 * @desc Obtener imagen de empresa del usuario autenticado
 * @access Private
 */
router.get('/', EmpresaImagenController.getByUserId);

/**
 * @route PUT /api/empresa-imagen
 * @desc Actualizar imagen de empresa del usuario autenticado
 * @access Private
 */
router.put('/', EmpresaImagenController.update);

/**
 * @route DELETE /api/empresa-imagen
 * @desc Eliminar imagen de empresa del usuario autenticado
 * @access Private
 */
router.delete('/', EmpresaImagenController.delete);

/**
 * @route GET /api/empresa-imagen/transformed
 * @desc Obtener URL transformada de la imagen
 * @access Private
 * @query {number} width - Ancho de la imagen (default: 200)
 * @query {number} height - Alto de la imagen (default: 200)
 * @query {string} crop - Tipo de recorte (default: 'fill')
 * @query {string} gravity - Punto de enfoque (default: 'face')
 */
router.get('/transformed', EmpresaImagenController.getTransformedUrl);

module.exports = router;
