const express = require('express');
const router = express.Router();
const permissionsController = require('../controllers/permissionsController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/info', permissionsController.getInfoPermission);

module.exports = router;

