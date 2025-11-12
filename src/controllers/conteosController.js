const ConteosModel = require('../models/conteos');
const { checkDeletePermission, checkReplacePermission } = require('../utils/permissionsHelper');

class ConteosController {
	static async create(req, res) {
		try {
			const { tipo, sucursal_id, observaciones, detalles } = req.body;
			const userType = req.user?.type;
			const user_id = userType === 'employee' ? null : req.user?.id;
			const personal_id = userType === 'employee' ? req.user?.id : null;

			if (!sucursal_id) {
				return res.status(400).json({ success: false, message: 'ID de la sucursal es requerido' });
			}

			const payload = {
				tipo,
				sucursal_id,
				observaciones: observaciones || null,
				detalles: Array.isArray(detalles) ? detalles : [],
				user_id,
				personal_id
			};

			const result = await ConteosModel.create(payload);
			
			if (!result.success) {
				return res.status(400).json(result);
			}

			return res.status(201).json({ success: true, id: result.data.id });
		} catch (error) {
			console.error('[CONTEO CONTROLLER] Error en ConteosController.create:', error);
			return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
		}
	}

	static async getAll(req, res) {
		try {
			const sucu_id = req.query.sucu_id;
			const tipo = req.query.tipo || null; // 'acopio' | 'almacen' | null

			if (!sucu_id) {
				return res.status(400).json({ success: false, message: 'ID de la sucursal es requerido' });
			}

			// sucu_id es un UUID, mantenerlo como string
			const sucursal_id = sucu_id;

			const result = await ConteosModel.getAll({ sucursal_id, tipo });
			
			if (!result.success) {
				return res.status(400).json(result);
			}

			return res.json({ success: true, data: result.data });
		} catch (error) {
			console.error('[CONTEO CONTROLLER] Error en ConteosController.getAll:', error);
			return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
		}
	}

	static async getDetalles(req, res) {
		try {
			const { id } = req.params;

			if (!id) {
				return res.status(400).json({ success: false, message: 'ID del conteo es requerido' });
			}

			const result = await ConteosModel.getDetalles(id);
			
			if (!result.success) {
				return res.status(400).json(result);
			}

			return res.json({ success: true, data: result.data });
		} catch (error) {
			console.error('[CONTEO CONTROLLER] Error en ConteosController.getDetalles:', error);
			return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
		}
	}

	static async delete(req, res) {
		try {
			const { id } = req.params;
			const userType = req.user?.type;

			if (!id) {
				return res.status(400).json({ success: false, message: 'ID del conteo es requerido' });
			}

			// Verificar permisos de eliminación solo si es empleado
			if (userType === 'employee') {
				const personal_id = req.user.id; // El personal_id viene del token

				const hasPermission = await checkDeletePermission(personal_id);
				if (!hasPermission) {
					return res.status(403).json({
						success: false,
						message: 'No tienes permisos para eliminar conteos'
					});
				}
			}

			const result = await ConteosModel.delete(id);
			if (!result.success) {
				return res.status(400).json(result);
			}

			return res.json({ success: true, message: result.message });
		} catch (error) {
			console.error('Error en ConteosController.delete:', error);
			return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
		}
	}

	static async replaceStock(req, res) {
		try {
			const { id } = req.params;
			const { empresa_id } = req.body;
			const userType = req.user?.type;

			if (!id) {
				return res.status(400).json({ success: false, message: 'ID del conteo es requerido' });
			}

			if (!empresa_id) {
				return res.status(400).json({ success: false, message: 'ID de la empresa es requerido' });
			}

			// Verificar permisos de reemplazo solo si es empleado
			if (userType === 'employee') {
				const personal_id = req.user.id; // El personal_id viene del token

				const hasPermission = await checkReplacePermission(personal_id);
				if (!hasPermission) {
					return res.status(403).json({
						success: false,
						message: 'No tienes permisos para reemplazar stock'
					});
				}
			}

			const result = await ConteosModel.replaceStock(id);
			if (!result.success) {
				return res.status(400).json(result);
			}

		return res.json({ success: true, message: result.message, data: result.data });
	} catch (error) {
		console.error('Error en ConteosController.replaceStock:', error);
		return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
	}
}

	static async replaceStockAcopio(req, res) {
		try {
			const { id } = req.params;
			const { empresa_id } = req.body;
			const userType = req.user?.type;

			if (!id) {
				return res.status(400).json({ success: false, message: 'ID del conteo es requerido' });
			}

			if (!empresa_id) {
				return res.status(400).json({ success: false, message: 'ID de la empresa es requerido' });
			}

			// Verificar permisos de reemplazo solo si es empleado
			if (userType === 'employee') {
				const personal_id = req.user.id; // El personal_id viene del token

				const hasPermission = await checkReplacePermission(personal_id);
				if (!hasPermission) {
					return res.status(403).json({
						success: false,
						message: 'No tienes permisos para reemplazar stock de acopio'
					});
				}
			}

			const result = await ConteosModel.replaceStockAcopio(id);
			if (!result.success) {
				return res.status(400).json(result);
			}

			return res.json({ success: true, message: result.message, data: result.data });
		} catch (error) {
			console.error('Error en ConteosController.replaceStockAcopio:', error);
			return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
		}
	}
}

module.exports = ConteosController;


