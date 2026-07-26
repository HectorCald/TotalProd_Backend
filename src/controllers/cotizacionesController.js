const cotizaciones = require('../models/cotizaciones');

class cotizacionesController {

    static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
        const {
            requireAuth = true,
            validateSucuId = false,
            validateCotizacionId = false,
            successStatus = 200,
            errorStatus = 400
        } = options;

        try {
            if (requireAuth) {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        message: 'Usuario no autenticado'
                    });
                }
            }

            if (validateSucuId) {
                const sucuId = req.query.sucu_id || req.body.sucu_id || req.user?.sucu_id;
                if (!sucuId) {
                    return res.status(400).json({
                        success: false,
                        message: 'El ID de la sucursal es requerido'
                    });
                }
                if (req.query) req.query.sucu_id = sucuId;
                if (req.body) req.body.sucu_id = sucuId;
            }

            if (validateCotizacionId) {
                const { id } = req.params;
                if (!id) {
                    return res.status(400).json({
                        success: false,
                        message: 'El ID de la cotización es requerido'
                    });
                }
            }

            const result = await handlerFn();

            if (!result.success) {
                return res.status(errorStatus).json(result);
            }

            return res.status(successStatus).json(result);
        } catch (error) {
            console.error(`Error en cotizacionesController.${actionName}:`, error);
            return res.status(500).json({
                success: false,
                message: 'Ocurrió un error inesperado',
                error: error.message
            });
        }
    }

    // Crear una nueva cotización
    static async create(req, res) {
        const { sucu_id, personal_id, observaciones, metodo_pago, cliente_id, productos, fecha_vencimiento, agrupado, precio_id } = req.body;

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

        return cotizacionesController._handleRequest(res, 'create', req, async () => {
            const user_id = req.user?.id;
            const userType = req.user?.type;

            const finalUserId = userType === 'employee' ? null : user_id;
            const finalPersonalId = userType === 'employee' ? personal_id : null;

            const cotizacionData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                sucu_id: req.body.sucu_id,
                observaciones: observaciones || null,
                metodo_pago: metodo_pago || null,
                cliente_id: cliente_id || null,
                productos,
                fecha_vencimiento: fecha_vencimiento || null,
                agrupado: agrupado || false,
                precio_id: precio_id || null
            };

            const result = await cotizaciones.create(cotizacionData);
            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: result.data
            };
        }, {
            validateSucuId: true,
            successStatus: 201
        });
    }

    // Crear cotización rápida de golpe
    static async createFast(req, res) {
        const { metodo_pago, cliente_id, precio_id, productos, fecha_vencimiento, agrupado, descuento, aumento, porcentaje, fecha } = req.body;
        const sucu_id = req.headers['x-sucu-id'] || req.body.sucu_id;

        if (!sucu_id) return res.status(400).json({ success: false, message: 'Sucursal no especificada' });
        if (!metodo_pago) return res.status(400).json({ success: false, message: 'Método de pago requerido' });
        if (!precio_id) return res.status(400).json({ success: false, message: 'Precio requerido' });
        if (!productos || productos.length === 0) return res.status(400).json({ success: false, message: 'Debe incluir al menos un producto' });

        return cotizacionesController._handleRequest(res, 'createFast', req, async () => {
            const user_id = req.user?.id || null;
            const userType = req.user?.type;
            const personal_id = userType === 'employee' ? (req.body.personal_id || null) : null;
            const finalUserId = userType === 'employee' ? null : user_id;

            const result = await cotizaciones.createFast({
                user_id: finalUserId,
                personal_id,
                sucu_id,
                metodo_pago,
                cliente_id: cliente_id || null,
                precio_id,
                productos,
                fecha_vencimiento: fecha_vencimiento || null,
                agrupado: !!agrupado,
                descuento: parseFloat(descuento) || 0,
                aumento: parseFloat(aumento) || 0,
                porcentaje: !!porcentaje,
                fecha
            });

            return result;
        }, { successStatus: 201 });
    }

    // Obtener una cotización por ID
    static async getById(req, res) {
        return cotizacionesController._handleRequest(res, 'getById', req, async () => {
            const { id } = req.params;
            return await cotizaciones.getById(id);
        }, {
            validateCotizacionId: true
        });
    }

    // Obtener todas las cotizaciones de una sucursal
    static async getAll(req, res) {
        return cotizacionesController._handleRequest(res, 'getAll', req, async () => {
            const sucuId = req.query.sucu_id;
            const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
            const limit = Math.max(parseInt(req.query.limit, 10) || 30, 1);
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const clienteId = req.query.cliente || null;
            const search = req.query.search || null;
            const { fecha_inicio = null, fecha_fin = null } = req.query;

            let filtroFecha = null;
            if (fecha_inicio || fecha_fin) {
                filtroFecha = {
                    inicio: fecha_inicio || null,
                    fin: fecha_fin || null
                };
            }

            const result = await cotizaciones.getAll(
                sucuId,
                page,
                limit,
                estado,
                ordenamiento,
                search,
                clienteId,
                filtroFecha
            );

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: result.data,
                pagination: result.pagination
            };
        }, {
            validateSucuId: true
        });
    }

    // Actualizar estado de una cotización
    static async actualizarEstado(req, res) {
        const { id } = req.params;
        const { estado } = req.body || {};

        if (!id || !estado) {
            return res.status(400).json({
                success: false,
                message: 'El ID de cotización y estado son requeridos'
            });
        }

        return cotizacionesController._handleRequest(res, 'actualizarEstado', req, async () => {
            const result = await cotizaciones.actualizarEstado(id, estado);
            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: result.data
            };
        });
    }

    // Eliminar una cotización
    static async eliminar(req, res) {
        return cotizacionesController._handleRequest(res, 'eliminar', req, async () => {
            const { id } = req.params;
            const result = await cotizaciones.eliminar(id);
            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: result.data
            };
        }, {
            validateCotizacionId: true
        });
    }
}

module.exports = cotizacionesController;
