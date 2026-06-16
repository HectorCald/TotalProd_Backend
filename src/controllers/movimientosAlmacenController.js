const movimientosAlmacen = require('../models/movimientosAlmacen');
const transferenciasAlmacen = require('../models/transferenciasAlmacen');
const { checkDeletePermission, checkAnularPermission } = require('../utils/permissionsHelper');

class movimientosAlmacenController {

    static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
        const {
            validateSucuId = false,
            validateId = false,
            checkPermission = null,
            successStatus = 200,
            passRawResult = false
        } = options;

        try {
            if (validateSucuId) {
                const sucuId = req.query.sucu_id || req.headers['x-sucu-id'] || req.body.sucu_id;
                if (!sucuId) {
                    return res.status(400).json({ success: false, message: 'ID de la sucursal es requerido' });
                }
            }

            if (validateId) {
                const { id } = req.params;
                if (!id) {
                    return res.status(400).json({ success: false, message: 'ID del movimiento es requerido' });
                }
            }

            if (checkPermission) {
                const userType = req.user?.type;
                const esEdicion = req.body?.esEdicion;
                if (userType === 'employee' && !esEdicion) {
                    const personal_id = req.user.id;
                    let hasPermission = false;
                    if (checkPermission === 'delete') hasPermission = await checkDeletePermission(personal_id);
                    else if (checkPermission === 'anular') hasPermission = await checkAnularPermission(personal_id);
                    if (!hasPermission) {
                        return res.status(403).json({
                            success: false,
                            message: `No tienes permisos para ${checkPermission === 'delete' ? 'eliminar' : 'anular'} movimientos`
                        });
                    }
                }
            }

            const result = await handlerFn();

            if (passRawResult) {
                return res.status(successStatus).json(result);
            }

            if (result && result.success === false) {
                return res.status(400).json(result);
            }

            return res.status(successStatus).json(result);
        } catch (error) {
            console.error(`Error en ${actionName}:`, error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
        }
    }

    // Crear un nuevo movimiento
    static async create(req, res) {
        try {
            const { sucu_id, personal_id, type, observaciones, metodo_pago, cliente_id, proveedor_id, precio_id, productos, restar_ingredientes, produccion_damabrava_id, agrupado, gasto_id, descuento, aumento, fecha, numero_orden, concepto, ubicacion, porcentaje } = req.body;
            const user_id = req.user?.id;
            const userType = req.user?.type;

            const finalUserId = userType === 'employee' ? null : user_id;
            const finalPersonalId = userType === 'employee' ? personal_id : null;

            if (!sucu_id) return res.status(400).json({ success: false, message: 'ID de la sucursal es requerido' });
            if (!type || !['entrada', 'salida'].includes(type)) return res.status(400).json({ success: false, message: 'El tipo de movimiento es obligatorio y debe ser "entrada" o "salida"' });
            if (!productos || !Array.isArray(productos) || productos.length === 0) return res.status(400).json({ success: false, message: 'Debe incluir al menos un producto en el movimiento' });

            for (const producto of productos) {
                if (!producto.id) return res.status(400).json({ success: false, message: 'Todos los productos deben tener un ID válido' });
                if (!producto.cantidad || producto.cantidad <= 0) return res.status(400).json({ success: false, message: 'Todos los productos deben tener una cantidad válida mayor a 0' });
                if (producto.precio === undefined || producto.precio === null || producto.precio < 0) return res.status(400).json({ success: false, message: 'Todos los productos deben tener un precio válido mayor o igual a 0' });
            }

            let finalPrecioId = precio_id;
            if (!precio_id && produccion_damabrava_id) finalPrecioId = null;

            const movimientoData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                sucu_id,
                type,
                observaciones: observaciones || null,
                metodo_pago: metodo_pago || null,
                cliente_id: type === 'salida' ? (cliente_id || null) : null,
                proveedor_id: type === 'entrada' ? (proveedor_id || null) : null,
                precio_id: finalPrecioId,
                productos,
                restar_ingredientes: restar_ingredientes || false,
                produccion_damabrava_id: produccion_damabrava_id || null,
                descuento: parseFloat(descuento) || 0,
                aumento: parseFloat(aumento) || 0,
                concepto: concepto && concepto.trim() !== '' ? concepto.trim() : null,
                porcentaje: (() => {
                    const tieneDescuentoAumento = (parseFloat(descuento) || 0) > 0 || (parseFloat(aumento) || 0) > 0;
                    if (!tieneDescuentoAumento) return null;
                    return porcentaje === true ? true : (porcentaje === false ? false : null);
                })(),
                ...(gasto_id ? { gasto_id } : {}),
                ...(typeof agrupado !== 'undefined' ? { agrupado: !!agrupado } : {}),
                ...(fecha ? { fecha } : {}),
                ...(numero_orden !== undefined ? { numero_orden } : {}),
                ...(ubicacion ? { ubicacion } : {})
            };

            if (type === 'entrada' && restar_ingredientes) {
                try {
                    const productsAlmacen = require('../models/productsAlmacen');
                    const productIds = productos.map(p => p.id);
                    const productosConRecetas = await productsAlmacen.getByIds(productIds, req.user?.empresa_id || null);
                    const ingredientesParaRestar = [];

                    for (const productoData of productos) {
                        const producto = productosConRecetas.find(p => p.id === productoData.id);
                        if (producto?.recetas?.[0]?.recetas_detalle?.length > 0) {
                            ingredientesParaRestar.push({ producto, cantidad: parseFloat(productoData.cantidad), ingredientes: producto.recetas[0].recetas_detalle });
                        }
                    }

                    if (ingredientesParaRestar.length > 0) {
                        const validacion = await movimientosAlmacen.restarIngredientesBatch(ingredientesParaRestar, req.user.empresa_id);
                        if (!validacion.success) {
                            return res.status(400).json({ success: false, message: validacion.message, ingredientesConStockInsuficiente: validacion.ingredientesConStockInsuficiente });
                        }
                    }
                } catch (error) {
                    return res.status(400).json({ success: false, message: 'Error al validar el stock de ingredientes: ' + error.message });
                }
            }

            const result = await movimientosAlmacen.create(movimientoData);
            if (!result.success) return res.status(400).json(result);
            return res.status(201).json({ success: true, id: result.data.id });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.create:', error);
            return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
        }
    }

    // Crear movimiento rápido (entrada o salida)
    static async createFast(req, res) {
        const { type, metodo_pago, cliente_id, proveedor_id, precio_id, productos, descuento, aumento, concepto, porcentaje, agrupado } = req.body;
        const sucu_id = req.headers['x-sucu-id'] || req.body.sucu_id;
        const user_id = req.user?.id || null;

        if (!sucu_id) return res.status(400).json({ success: false, message: 'Sucursal no especificada' });
        if (!type) return res.status(400).json({ success: false, message: 'Tipo de movimiento requerido' });
        if (!metodo_pago) return res.status(400).json({ success: false, message: 'Método de pago requerido' });
        if (!precio_id) return res.status(400).json({ success: false, message: 'Precio requerido' });
        if (!productos || productos.length === 0) return res.status(400).json({ success: false, message: 'Debe incluir al menos un producto' });

        return movimientosAlmacenController._handleRequest(res, 'createFast', req, async () => {
            return await movimientosAlmacen.createFast({
                user_id,
                sucu_id,
                type,
                metodo_pago,
                cliente_id: cliente_id || null,
                proveedor_id: proveedor_id || null,
                precio_id,
                productos,
                descuento: parseFloat(descuento) || 0,
                aumento: parseFloat(aumento) || 0,
                concepto: concepto || null,
                porcentaje: !!porcentaje,
                agrupado: !!agrupado
            });
        }, { successStatus: 201, passRawResult: true });
    }

    // Obtener todos los movimientos de la sucursal
    static async getAll(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getAll', req, async () => {
            const sucu_id = req.query.sucu_id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 30;
            const tipo = req.query.tipo || null;
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const search = req.query.search || null;
            const cliente = req.query.cliente || null;
            const filtroFecha = (req.query.fecha_inicio || req.query.fecha_fin)
                ? { inicio: req.query.fecha_inicio || null, fin: req.query.fecha_fin || null }
                : null;

            const bufferLimit = 99999;

            let resultMovimientos = { success: true, data: [], pagination: { total: 0 } };
            let totalMovimientos = 0;
            if (tipo !== 'transferencia') {
                resultMovimientos = await movimientosAlmacen.getAll(sucu_id, 1, bufferLimit, tipo, estado, ordenamiento, search, cliente, filtroFecha);
                if (!resultMovimientos.success) throw new Error(resultMovimientos.message);
                totalMovimientos = resultMovimientos.pagination?.total || resultMovimientos.data?.length || 0;
            }

            let transferencias = [];
            let totalTransferencias = 0;
            if (!tipo || tipo === 'transferencia') {
                const estadoT = estado === 'finalizado' ? 'Finalizado' : estado === 'anulado' ? 'Anulado' : null;
                const resultT = await transferenciasAlmacen.getAll(sucu_id, 1, bufferLimit, estadoT, ordenamiento, search, filtroFecha, cliente || null);
                if (resultT.success && resultT.data) {
                    totalTransferencias = resultT.pagination?.total || resultT.data?.length || 0;
                    transferencias = resultT.data.map(t => ({
                        id: t.id, type: 'transferencia', fecha: t.fecha,
                        estado: t.estado === 'Anulado' ? 'anulado' : 'finalizado',
                        concepto: t.concepto || `${t.sucursal_origen?.name || 'Origen'} > ${t.sucursal_destino?.name || 'Destino'}`,
                        sucu_id: t.sucu_origen_id, sucu_origen_id: t.sucu_origen_id, sucu_destino_id: t.sucu_destino_id,
                        sucursal: t.sucursal_origen, sucursal_origen: t.sucursal_origen, sucursal_destino: t.sucursal_destino,
                        precio: t.precio, precio_id: t.precio_id, agrupado: t.agrupado,
                        productos: t.productos || [], user: t.user, personal: t.personal,
                        cliente: t.cliente || null, cliente_id: t.cliente_id || null,
                        descuento: 0, aumento: 0, numero_orden: null, metodo_pago: null, proveedor: null
                    }));
                }
            }

            const allData = [...(resultMovimientos.data || []), ...transferencias];
            allData.sort((a, b) => {
                const diff = new Date(a.fecha) - new Date(b.fecha);
                return ordenamiento === 'fecha_asc' ? diff : -diff;
            });

            const totalCombinado = search ? allData.length : (totalMovimientos + totalTransferencias);
            const startIndex = (page - 1) * limit;
            const paginatedData = allData.slice(startIndex, startIndex + limit);

            return {
                success: true,
                data: paginatedData,
                pagination: { total: totalCombinado, page, limit, hasNextPage: (startIndex + limit) < totalCombinado }
            };
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener estadísticas para gráficos
    static async getStatsForCharts(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getStatsForCharts', req, async () => {
            return await movimientosAlmacen.getStatsForCharts(req.query.sucu_id);
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener movimientos por tipo
    static async getByType(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getByType', req, async () => {
            const { tipo } = req.params;
            const sucu_id = req.query.sucu_id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 30;
            return await movimientosAlmacen.getAll(sucu_id, page, limit, tipo);
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener movimiento por ID
    static async getById(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getById', req, async () => {
            const { id } = req.params;
            const sucu_id = req.query.sucu_id;
            const result = await movimientosAlmacen.getById(id);
            if (!result.success) return res.status(404).json(result);

            if (result.data.sucu_id !== sucu_id) {
                const { data: pedidos, error } = await require('../config/supabase').supabase
                    .from('pedidos_almacen')
                    .select('sucursal_id, sucursal_destino_id')
                    .or(`movimiento_salida_id.eq.${id},movimiento_entrada_id.eq.${id}`)
                    .limit(1);

                const participa = !error && pedidos?.length > 0 &&
                    (pedidos[0].sucursal_id === sucu_id || pedidos[0].sucursal_destino_id === sucu_id);

                if (!participa) return res.status(403).json({ success: false, message: 'No tienes permisos para ver este movimiento' });
            }
            return result;
        }, { validateSucuId: true, passRawResult: true });
    }

    // Anular movimiento
    static async anular(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'anular', req, async () => {
            const result = await movimientosAlmacen.anular(req.params.id, req.body.desdePedido);
            if (!result.success) throw new Error(result.message);
            return { success: true, message: 'Movimiento anulado correctamente', data: result.data };
        }, { validateId: true, checkPermission: 'anular', passRawResult: true });
    }

    // Eliminar movimiento
    static async eliminar(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'eliminar', req, async () => {
            const result = await movimientosAlmacen.eliminar(req.params.id);
            if (!result.success) throw new Error(result.message);
            return { success: true, message: 'Movimiento eliminado correctamente' };
        }, { validateId: true, checkPermission: 'delete', passRawResult: true });
    }

    // Verificar si un producto tiene movimientos
    static async hasMovements(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'hasMovements', req, async () => {
            const { productId } = req.params;
            if (!productId) throw new Error('ID del producto es requerido');
            const result = await movimientosAlmacen.hasMovements(productId, req.query.sucu_id);
            return { success: true, hasMovements: result.hasMovements };
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener movimientos por producto
    static async getByProduct(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getByProduct', req, async () => {
            return await movimientosAlmacen.getByProduct(req.params.productId, req.query.sucu_id);
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener movimientos por cliente
    static async getByCliente(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getByCliente', req, async () => {
            return await movimientosAlmacen.getByCliente(req.params.clienteId, req.query.sucu_id);
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener movimientos por producción Damabrava
    static async getByProduccionDamabrava(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getByProduccionDamabrava', req, async () => {
            return await movimientosAlmacen.getByProduccionDamabrava(req.params.produccionId, req.query.sucu_id);
        }, { validateSucuId: true, passRawResult: true });
    }

    // Actualizar movimiento
    static async update(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'update', req, async () => {
            return await movimientosAlmacen.update(req.params.id, req.body);
        }, { validateId: true, passRawResult: true });
    }

    // Eliminar productos de un movimiento
    static async deleteProductos(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'deleteProductos', req, async () => {
            return await movimientosAlmacen.deleteProductos(req.params.id);
        }, { validateId: true, passRawResult: true });
    }

    // Crear productos de un movimiento
    static async createProductos(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'createProductos', req, async () => {
            const { productos } = req.body;
            if (!productos || !Array.isArray(productos)) throw new Error('Productos son requeridos');
            return await movimientosAlmacen.createProductos(req.params.id, productos);
        }, { validateId: true, passRawResult: true });
    }
}

module.exports = movimientosAlmacenController;
