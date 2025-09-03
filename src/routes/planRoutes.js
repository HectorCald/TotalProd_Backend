const express = require('express');
const PlanController = require('../controllers/planController');
const router = express.Router();

// Obtener todos los planes
router.get('/', PlanController.getAllPlans);

// Obtener un plan por ID
router.get('/:id', PlanController.getPlanById);

module.exports = router;
