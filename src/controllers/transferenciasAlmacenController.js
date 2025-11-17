const transferenciasAlmacen = require('../models/transferenciasAlmacen');

class transferenciasAlmacenController {
    // Crear una nueva transferencia
    static async create(req, res) {
        try {
            const { sucu_origen_id, sucu_destino_id, concepto, productos, agrupado, precio_id, empresa_id: empresaIdBody, cliente_id } = req.body;
            const user_id = req.user?.id;
            const userType = req.user?.type;
            // Priorizar empresa_id del body (enviado por el frontend), si no, usar del user
            const empresa_id = empresaIdBody || req.user?.empresa_id;

            // Si es empleado, usar personal_id, si es usuario normal, usar user_id
            const finalUserId = userType === 'employee' ? null : user_id;
            const finalPersonalId = userType === 'employee' ? req.body.personal_id : null;

            // Validar que se proporcione sucu_origen_id
            if (!sucu_origen_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal de origen es requerido'
                });
            }

            // Validar que se proporcione sucu_destino_id
            if (!sucu_destino_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal de destino es requerido'
                });
            }

            // Validar que no sean la misma sucursal
            if (sucu_origen_id === sucu_destino_id) {
                return res.status(400).json({
                    success: false,
                    message: 'La sucursal de origen y destino no pueden ser la misma'
                });
            }

            if (!productos || !Array.isArray(productos) || productos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe incluir al menos un producto en la transferencia'
                });
            }

            // Validar que los productos tengan los campos requeridos
            for (const producto of productos) {
                if (!producto.id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Todos los productos deben tener un ID válido'
                    });
                }
                if (!producto.cantidad || producto.cantidad <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Todos los productos deben tener una cantidad válida mayor a 0'
                    });
                }
                if (producto.precio === undefined || producto.precio === null || producto.precio < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Todos los productos deben tener un precio válido mayor o igual a 0'
                    });
                }
            }

            // Validar precio_id (requerido según la tabla)
            if (!precio_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El precio_id es requerido'
                });
            }

            // Validar empresa_id (requerido según la tabla)
            if (!empresa_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El empresa_id es requerido'
                });
            }

            // Preparar datos de la transferencia
            const transferenciaData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                empresa_id,
                sucu_origen_id,
                sucu_destino_id,
                concepto: concepto && concepto.trim() !== '' ? concepto.trim() : null,
                productos,
                agrupado: typeof agrupado !== 'undefined' ? !!agrupado : false,
                precio_id,
                cliente_id: cliente_id || null
            };

            // Crear la transferencia
            const result = await transferenciasAlmacen.create(transferenciaData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(201).json({
                success: true,
                id: result.data.id
            });

        } catch (error) {
            console.error('Error en transferenciasAlmacenController.create:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener todas las transferencias de la sucursal
    static async getAll(req, res) {
        try {
            const sucu_id = req.query.sucu_id;
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.max(parseInt(req.query.limit, 10) || 30, 1);
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const search = req.query.search || null;
            const clienteId = req.query.cliente_id || null;
            const { fecha_inicio = null, fecha_fin = null } = req.query;
            
            console.log('[transferenciasAlmacenController.getAll] Parámetros recibidos:', {
                sucu_id,
                page,
                limit,
                estado,
                ordenamiento,
                search,
                clienteId,
                fecha_inicio,
                fecha_fin
            });
            
            if (!sucu_id) {
                console.error('[transferenciasAlmacenController.getAll] Error: sucu_id no proporcionado');
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            let filtroFecha = null;
            if (fecha_inicio || fecha_fin) {
                filtroFecha = {
                    inicio: fecha_inicio || null,
                    fin: fecha_fin || null
                };
            }

            const result = await transferenciasAlmacen.getAll(sucu_id, page, limit, estado, ordenamiento, search, filtroFecha, clienteId);

            if (!result.success) {
                console.error('[transferenciasAlmacenController.getAll] Error en modelo:', result.message, result.error);
                return res.status(400).json(result);
            }

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('Error en transferenciasAlmacenController.getAll:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener una transferencia por ID
    static async getById(req, res) {
        try {
            const { id } = req.params;
            const sucu_id = req.query.sucu_id;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            const result = await transferenciasAlmacen.getById(id);

            if (!result.success) {
                return res.status(404).json(result);
            }

            // Verificar que la transferencia pertenece a la sucursal (origen o destino)
            if (result.data.sucu_origen_id !== sucu_id && result.data.sucu_destino_id !== sucu_id) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver esta transferencia'
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en transferenciasAlmacenController.getById:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Actualizar estado de una transferencia
    static async actualizarEstado(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body || {};

            if (!id || !estado) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de transferencia y estado son requeridos'
                });
            }

            const result = await transferenciasAlmacen.actualizarEstado(id, estado);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en transferenciasAlmacenController.actualizarEstado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Eliminar una transferencia
    static async eliminar(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de transferencia requerido'
                });
            }

            const result = await transferenciasAlmacen.eliminar(id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en transferenciasAlmacenController.eliminar:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = transferenciasAlmacenController;

