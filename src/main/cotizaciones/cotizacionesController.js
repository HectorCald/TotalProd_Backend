const cotizaciones = require('./cotizaciones');

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

    // Crear cotización
    static async create(req, res) {
        const { metodo_pago, cliente_id, precio_id, productos, fecha_vencimiento, agrupado, descuento, aumento, porcentaje, fecha } = req.body;
        const sucu_id = req.headers['x-sucu-id'] || req.body.sucu_id;

        if (!sucu_id) return res.status(400).json({ success: false, message: 'Sucursal no especificada' });
        if (!metodo_pago) return res.status(400).json({ success: false, message: 'Método de pago requerido' });
        if (!precio_id) return res.status(400).json({ success: false, message: 'Precio requerido' });
        if (!productos || productos.length === 0) return res.status(400).json({ success: false, message: 'Debe incluir al menos un producto' });

        return cotizacionesController._handleRequest(res, 'create', req, async () => {
            const user_id = req.user?.id || null;
            const userType = req.user?.type;
            const personal_id = userType === 'employee' ? (req.body.personal_id || null) : null;
            const finalUserId = userType === 'employee' ? null : user_id;

            const result = await cotizaciones.create({
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

    // Eliminar una cotización
    static async delete(req, res) {
        return cotizacionesController._handleRequest(res, 'delete', req, async () => {
            const { id } = req.params;
            const result = await cotizaciones.delete(id);
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

        // Obtener una cotización por ID
    static async getById(req, res) {
        return cotizacionesController._handleRequest(res, 'getById', req, async () => {
            const { id } = req.params;
            return await cotizaciones.getById(id);
        }, {
            validateCotizacionId: true
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
}

module.exports = cotizacionesController;
