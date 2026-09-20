const express = require('express');
const router = express.Router();
const ConteosController = require('./conteosController');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

router.get('/:id/detalles', ConteosController.getDetalles);
router.post('/', ConteosController.create);
router.get('/', ConteosController.getAll);
router.post('/:id/replace', ConteosController.replaceStock);
router.post('/:id/replace-acopio', ConteosController.replaceStockAcopio);
router.delete('/:id', ConteosController.delete);

module.exports = router;


