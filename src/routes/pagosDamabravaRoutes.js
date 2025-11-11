const express = require('express');
const router = express.Router();
const pagosDamabravaController = require('../controllers/pagosDamabravaController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', pagosDamabravaController.create);
router.get('/', pagosDamabravaController.getAll);
router.get('/:id', pagosDamabravaController.getById);
router.get('/:id/registros', pagosDamabravaController.getRegistros);
router.put('/:id/estado', pagosDamabravaController.updateEstado);
router.delete('/:id', pagosDamabravaController.delete);

module.exports = router;

