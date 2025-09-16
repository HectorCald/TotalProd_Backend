const express = require('express');
const router = express.Router();
const sucursalesController = require('../controllers/sucursalesController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/empresa/:empresaId', sucursalesController.getByEmpresaId);
router.get('/:id', sucursalesController.getById);
router.post('/', sucursalesController.create);
router.patch('/:id', sucursalesController.update);
router.delete('/:id', sucursalesController.delete);

module.exports = router;
