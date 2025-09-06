const express = require('express');
const PlanController = require('../controllers/planController');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Obtener todos los planes
router.get('/', PlanController.getAllPlans);

// Obtener el plan actual del usuario (requiere autenticación)
router.get('/current', requireAuth, PlanController.getCurrentPlan);

// Obtener un plan por ID
router.get('/:id', PlanController.getPlanById);

module.exports = router;
