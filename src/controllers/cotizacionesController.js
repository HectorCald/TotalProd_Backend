const cotizaciones = require('../models/cotizaciones');

class cotizacionesController {
    // Crear una nueva cotización
    static async create(req, res) {
        try {
            const { sucu_id, personal_id, observaciones, metodo_pago, cliente_id, productos, fecha_vencimiento, agrupado, precio_id } = req.body;
            const user_id = req.user?.id;
            const userType = req.user?.type;

            // Si es empleado, usar personal_id, si es usuario normal, usar user_id
            const finalUserId = userType === 'employee' ? null : user_id;
            const finalPersonalId = userType === 'employee' ? personal_id : null;

            // Validar que se proporcione sucu_id
            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            // Validar que se incluyan productos
            if (!productos || !Array.isArray(productos) || productos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe incluir al menos un producto en la cotización'
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

            // Validar cliente_id si se proporciona
            if (cliente_id && typeof cliente_id !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del cliente debe ser válido'
                });
            }

            // Validar método de pago si se proporciona
            if (metodo_pago && !['qr', 'transferencia', 'tarjeta', 'efectivo', 'credito'].includes(metodo_pago)) {
                return res.status(400).json({
                    success: false,
                    message: 'El método de pago debe ser uno de: qr, transferencia, tarjeta, efectivo, credito'
                });
            }

            // Preparar datos de la cotización
            const cotizacionData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                sucu_id,
                observaciones: observaciones || null,
                metodo_pago: metodo_pago || null,
                cliente_id: cliente_id || null,
                productos,
                fecha_vencimiento: fecha_vencimiento || null,
                agrupado: agrupado || false,
                precio_id: precio_id || null
            };

            // Crear la cotización
            const result = await cotizaciones.create(cotizacionData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(201).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en cotizacionesController.create:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener una cotización por ID
    static async getById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cotización requerido'
                });
            }

            const result = await cotizaciones.getById(id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en cotizacionesController.getById:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener todas las cotizaciones de una sucursal
    static async getAll(req, res) {
        try {
            // Obtener el sucu_id de la sucursal seleccionada
            const sucuId = req.query.sucu_id;
            const { fecha_inicio = null, fecha_fin = null } = req.query;
            
            if (!sucuId) {
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

            const result = await cotizaciones.getAll(sucuId, filtroFecha);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en cotizacionesController.getAll:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Actualizar estado de una cotización
    static async actualizarEstado(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body || {};

            if (!id || !estado) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cotización y estado son requeridos'
                });
            }

            const result = await cotizaciones.actualizarEstado(id, estado);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en cotizacionesController.actualizarEstado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Eliminar una cotización
    static async eliminar(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cotización requerido'
                });
            }

            const result = await cotizaciones.eliminar(id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en cotizacionesController.eliminar:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = cotizacionesController;
