const express = require('express');
const router = express.Router();
const HistorialController = require('../controllers/historialController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', HistorialController.create);
router.get('/', HistorialController.getAll);
router.get('/responsables-unicos', HistorialController.getResponsablesUnicos);
router.get('/:id', HistorialController.getById);

module.exports = router;

