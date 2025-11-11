const express = require('express');
const router = express.Router();
const reglasProduccionDamabravaController = require('../controllers/reglasProduccionDamabravaController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/', reglasProduccionDamabravaController.create);
router.get('/', reglasProduccionDamabravaController.getAll);
router.delete('/:id', reglasProduccionDamabravaController.delete);

module.exports = router;

