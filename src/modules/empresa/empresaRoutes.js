const express = require('express');
const router = express.Router();
const EmpresaController = require('./empresaController');
const { requireAuth } = require('../../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(requireAuth);

router.get('/search/codigo', EmpresaController.searchByCodigo);
router.get('/disponibles', EmpresaController.getDisponibles);
router.post('/:id/verificar-codigo', EmpresaController.verificarCodigo);
router.put('/:id/organigrama', EmpresaController.updateOrganigrama);
router.get('/:id/imagen', EmpresaController.getImage);
router.get('/:id', EmpresaController.getById);

module.exports = router;

