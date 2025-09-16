const modules = require('../models/modules');

const modulesController = {
    // Obtener todos los módulos con sus submódulos
    async getAll(req, res) {
        try {
            const result = await modules.getAll();
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error en modulesController.getAll:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener un módulo específico con sus submódulos
    async getById(req, res) {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del módulo es requerido'
                });
            }

            const result = await modules.getById(id);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error en modulesController.getById:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
};

module.exports = modulesController;
