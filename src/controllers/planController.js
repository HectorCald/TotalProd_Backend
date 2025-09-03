const Plan = require('../models/Plan');

class PlanController {
    // Método para obtener todos los planes
    static async getAllPlans(req, res) {
        try {
            console.log('🔍 PlanController - getAllPlans - Iniciando...');
            
            const plans = await Plan.getAll();
            
            console.log('🔍 PlanController - getAllPlans - Planes obtenidos:', plans.length);
            
            res.status(200).json({
                success: true,
                message: 'Planes obtenidos exitosamente',
                data: {
                    plans: plans
                }
            });
        } catch (error) {
            console.error('Error en getAllPlans:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error interno del servidor'
            });
        }
    }

    // Método para obtener un plan por ID
    static async getPlanById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del plan es requerido'
                });
            }

            const plan = await Plan.getById(id);

            if (!plan) {
                return res.status(404).json({
                    success: false,
                    message: 'Plan no encontrado'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Plan obtenido exitosamente',
                data: {
                    plan: plan
                }
            });
        } catch (error) {
            console.error('Error en getPlanById:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error interno del servidor'
            });
        }
    }
}

module.exports = PlanController;
