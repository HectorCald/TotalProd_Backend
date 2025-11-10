const Historial = require('../models/historial');

class HistorialController {
    static async create(req, res) {
        try {
            const {
                modulo,
                accion,
                lugar_afectado,
                registro_id,
                empresa_id,
                detalles,
                fecha
            } = req.body;

            const userType = req.user?.type;
            const currentUserId = req.user?.id || null;
            const resolvedEmpresaId = empresa_id || req.user?.empresa_id || req.user?.empresaId;

            if (!resolvedEmpresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'El campo empresa_id es obligatorio'
                });
            }

            const payload = {
                modulo,
                accion,
                lugar_afectado,
                registro_id,
                empresa_id: resolvedEmpresaId,
                detalles,
                fecha
            };

            if (userType === 'employee') {
                payload.personal_id = currentUserId;
            } else {
                payload.user_id = currentUserId;
            }

            const result = await Historial.create(payload);

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.status(201).json({
                success: true,
                message: 'Historial registrado correctamente',
                data: result.data
            });
        } catch (error) {
            console.error('Error en HistorialController.create:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error interno del servidor'
            });
        }
    }

    static async getAll(req, res) {
        try {
            const {
                empresa_id,
                modulo,
                accion,
                registro_id,
                limit,
                offset,
                user_id,
                personal_id
            } = req.query;

            const resolvedEmpresaId = empresa_id || req.user?.empresa_id || req.user?.empresaId;

            if (!resolvedEmpresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'El campo empresa_id es obligatorio'
                });
            }

            const result = await Historial.getAll({
                empresa_id: resolvedEmpresaId,
                modulo,
                accion,
                registro_id,
                user_id,
                personal_id,
                limit: limit ? parseInt(limit, 10) : undefined,
                offset: offset ? parseInt(offset, 10) : undefined
            });

            if (!result.success) {
                return res.status(400).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error('Error en HistorialController.getAll:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error interno del servidor'
            });
        }
    }

    static async getById(req, res) {
        try {
            const { id } = req.params;

            const result = await Historial.getById(id);

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.json(result);
        } catch (error) {
            console.error('Error en HistorialController.getById:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Error interno del servidor'
            });
        }
    }
}

module.exports = HistorialController;

