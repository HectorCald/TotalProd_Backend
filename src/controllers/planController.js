const Plan = require('../models/Plan');
const User = require('../models/User');

class PlanController {
    // Método para obtener todos los planes
    static async getAllPlans(req, res) {
        try { 
            const plans = await Plan.getAll();
            
            
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

    // Método para obtener el plan actual del usuario
    static async getCurrentPlan(req, res) {
        try {
            const userId = req.user.id; // Obtener el ID del usuario desde el token

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
            }

            // Obtener el usuario con su plan
            const user = await User.getById(userId);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            // El modelo User.getById ya retorna el plan completo en user.plan
            if (!user.plan) {
                return res.status(200).json({
                    success: true,
                    message: 'Usuario no tiene plan asignado',
                    data: {
                        plan: null
                    }
                });
            }

            res.status(200).json({
                success: true,
                message: 'Plan actual obtenido exitosamente',
                data: {
                    plan: user.plan
                }
            });
        } catch (error) {
            console.error('Error en getCurrentPlan:', error);
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
