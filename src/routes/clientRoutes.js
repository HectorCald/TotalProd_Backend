const express = require('express');
const clientsController = require('../controllers/clientsController');

const router = express.Router();

router.get('/', clientsController.getAll);
router.post('/', clientsController.create);
router.put('/:id', clientsController.update);
router.delete('/:id', clientsController.delete);

module.exports = router;
