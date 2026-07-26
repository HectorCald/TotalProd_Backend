const movimientosAlmacen = require('../models/movimientosAlmacen');
const gastosModel = require('../models/gastos');
const deudasModel = require('../models/deudas');
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
                    return res.status(400).json({ success: false, message: 'El ID de la sucursal es requerido' });
                }
            }

            if (validateId) {
                const { id } = req.params;
                if (!id) {
                    return res.status(400).json({ success: false, message: 'El ID del movimiento es requerido' });
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
            return res.status(500).json({ success: false, message: 'Ocurrió un error inesperado', error: error.message });
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

            if (!sucu_id) return res.status(400).json({ success: false, message: 'El ID de la sucursal es requerido' });
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
            return res.status(500).json({ success: false, message: 'Ocurrió un error inesperado', error: error.message });
        }
    }

    // Obtener todos los movimientos sin límite (Optimizado)
    static async getAllSinLimite(req, res) {
        const sucu_id = req.headers['x-sucu-id'] || req.query.sucu_id;
        if (!sucu_id) return res.status(400).json({ success: false, message: 'Sucursal no especificada' });
        
        const { tipo, estado, ordenamiento, fecha_inicio, fecha_fin } = req.query;
        let filtroFecha = null;
        if (fecha_inicio || fecha_fin) {
            filtroFecha = { inicio: fecha_inicio, fin: fecha_fin };
        }

        return movimientosAlmacenController._handleRequest(res, 'getAllSinLimite', req, async () => {
            return await movimientosAlmacen.getAllSinLimite(sucu_id, tipo, estado, ordenamiento, filtroFecha);
        });
    }

    // Crear movimiento rápido (entrada o salida)
    static async createFast(req, res) {
        const { type, metodo_pago, cliente_id, proveedor_id, precio_id, productos, descuento, aumento, concepto, porcentaje, agrupado, restar_ingredientes,
                adelanto, total_final,
                registrar_gasto, costo, fecha_gasto, fecha } = req.body;
        const sucu_id = req.headers['x-sucu-id'] || req.body.sucu_id;
        const user_id = req.user?.id || null;
        const personal_id = req.user?.type === 'employee' ? user_id : null;
        const finalUserId = req.user?.type === 'employee' ? null : user_id;

        if (!sucu_id) return res.status(400).json({ success: false, message: 'Sucursal no especificada' });
        if (!type) return res.status(400).json({ success: false, message: 'Tipo de movimiento requerido' });
        if (!metodo_pago && type === 'salida') return res.status(400).json({ success: false, message: 'Método de pago requerido' });
        if (!precio_id) return res.status(400).json({ success: false, message: 'Precio requerido' });
        if (!productos || productos.length === 0) return res.status(400).json({ success: false, message: 'Debe incluir al menos un producto' });

        return movimientosAlmacenController._handleRequest(res, 'createFast', req, async () => {
            // ── 1. Crear el movimiento ───────────────────────────────────
            const movResult = await movimientosAlmacen.createFast({
                user_id: finalUserId,
                personal_id,
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
                agrupado: !!agrupado,
                restar_ingredientes: !!restar_ingredientes,
                fecha
            });

            if (!movResult.success) return movResult;
            const movimientoId = movResult.data.id;

            // ── 2. Fecha en zona horaria de Bolivia ────────────────────────
            const getBoliviaDate = (offsetMonths = 0) => {
                const d = new Date();
                if (offsetMonths) d.setMonth(d.getMonth() + offsetMonths);
                const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
                return `${tz.find(p => p.type === 'year').value}-${tz.find(p => p.type === 'month').value}-${tz.find(p => p.type === 'day').value}`;
            };

            // ── 3. Crear deuda automática si es venta a crédito ───────────
            if (type === 'salida' && metodo_pago?.toLowerCase() === 'credito' && cliente_id) {
                const { supabase } = require('../config/supabase');
                const { data: clienteObj } = await supabase.from('clients').select('name').eq('id', cliente_id).single();
                const montoDeuda = parseFloat(total_final) || 0;

                const deudaResult = await deudasModel.create({
                    user_id: finalUserId,
                    personal_id,
                    sucu_id,
                    fecha_deuda: fecha || getBoliviaDate(),
                    fecha_vencimiento: (() => {
                        const d = fecha ? new Date(fecha + 'T12:00:00Z') : new Date();
                        d.setMonth(d.getMonth() + 1);
                        return d.toISOString().split('T')[0];
                    })(),
                    monto_total: montoDeuda,
                    concepto: concepto || `Venta a ${clienteObj?.name || 'Cliente'}`,
                    cliente_id,
                    movimiento_salida_id: movimientoId
                });

                if (deudaResult.success && deudaResult.data?.id) {
                    const adelantoNum = parseFloat(adelanto) || 0;
                    if (adelantoNum > 0 && adelantoNum < montoDeuda) {
                        await deudasModel.createPagoParcial({
                            deuda_id: deudaResult.data.id,
                            monto: adelantoNum,
                            fecha: fecha || getBoliviaDate(),
                            detalle: 'Adelanto al realizar la venta',
                            user_id: finalUserId,
                            personal_id
                        });
                    }
                }
            }

            // ── 4. Crear gasto automático si es entrada con pago ──────────
            if (type === 'entrada' && registrar_gasto && parseFloat(costo) > 0) {
                await gastosModel.create({
                    user_id: finalUserId,
                    personal_id,
                    sucu_id,
                    fecha_gasto: fecha_gasto || fecha || getBoliviaDate(),
                    valor: parseFloat(costo),
                    concepto: concepto?.trim() || 'Pago de Entrada de Productos',
                    metodo_pago: (metodo_pago || 'efectivo').toLowerCase(),
                    proveedor_id: proveedor_id || null,
                    movimiento_entrada_id: movimientoId
                });
            }

            return movResult;
        }, { successStatus: 201, passRawResult: true });
    }
    // Obtener relaciones de un movimiento (gastos, pedidos, deudas)
    static async getRelations(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getRelations', req, async () => {
            const { id } = req.params;
            const { sucu_id } = req.query;
            return await movimientosAlmacen.getRelations(id, sucu_id);
        }, { validateId: true, passRawResult: true });
    }

    // Obtener todos los movimientos sin límite
    static async getAllSinLimite(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getAllSinLimite', req, async () => {
            const sucu_id = req.query.sucu_id;
            const tipo = req.query.tipo || null;
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const filtroFecha = (req.query.fecha_inicio || req.query.fecha_fin)
                ? { inicio: req.query.fecha_inicio || null, fin: req.query.fecha_fin || null }
                : null;

            return await movimientosAlmacen.getAllSinLimite(sucu_id, tipo, estado, ordenamiento, filtroFecha);
        }, { validateSucuId: true, passRawResult: true });
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

            const resultMovimientos = await movimientosAlmacen.getAll(sucu_id, page, limit, tipo, estado, ordenamiento, search, cliente, filtroFecha);
            if (!resultMovimientos.success) throw new Error(resultMovimientos.message);

            return {
                success: true,
                data: resultMovimientos.data,
                pagination: resultMovimientos.pagination
            };
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener estadísticas para gráficos
    static async getStatsForCharts(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getStatsForCharts', req, async () => {
            return await movimientosAlmacen.getStatsForCharts(req.query.sucu_id);
        }, { validateSucuId: true, passRawResult: true });
    }

    // Obtener categorías más vendidas del mes
    static async getCategoriasMasVendidas(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'getCategoriasMasVendidas', req, async () => {
            return await movimientosAlmacen.getCategoriasMasVendidas(req.query.sucu_id);
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

    // Anular movimiento de golpe
    static async anularFast(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'anularFast', req, async () => {
            const { id } = req.params;
            const supabase = require('../config/supabase').supabase;

            // ── 1. Verificar pedidos_almacen asociados (bloquear o manejar) ─────────────
            const { data: pedidoAlmacen } = await supabase
                .from('pedidos_almacen')
                .select('id, movimiento_salida_id, movimiento_entrada_id, estado')
                .or(`movimiento_salida_id.eq.${id},movimiento_entrada_id.eq.${id}`)
                .limit(1)
                .maybeSingle();

            if (pedidoAlmacen) {
                if (pedidoAlmacen.estado === 'Completado' || pedidoAlmacen.estado === 'Finalizado') {
                    return { success: false, message: 'No es posible anular ya que el pedido asociado está completado.' };
                }
                
                if (pedidoAlmacen.estado === 'Entregado' || pedidoAlmacen.estado === 'Pendiente') {
                    // Llamar a actualizar estado a Pendiente en lugar de fallar
                    // Esto limpia los campos de movimiento_salida_id, movimiento_entrada_id y deuda_id
                    const pedidosAlmacenController = require('./pedidosAlmacenController');
                    await require('../models/pedidosAlmacen').updateEstado(pedidoAlmacen.id, 'Pendiente');
                }
            }

            // ── 2. Verificar pedidos_acopio asociados (entrada) ───────────────
            const { data: pedidoAcopio } = await supabase
                .from('pedidos_acopio')
                .select('id, estado, gasto_id, gasto_otros_id')
                .eq('movimiento_entrada_id', id)
                .limit(1)
                .maybeSingle();

            if (pedidoAcopio) {
                if (pedidoAcopio.estado === 'Finalizado') {
                    return { success: false, message: 'No es posible anular: el pedido de acopio asociado está Finalizado.' };
                }
                if (pedidoAcopio.estado === 'Entregado') {
                    // Anular entrega del pedido: limpiar campos y eliminar gastos
                    await supabase
                        .from('pedidos_acopio')
                        .update({
                            estado: 'Pendiente',
                            fecha_entregado: null,
                            entregado_por: null,
                            cantidad_entregada: null,
                            cantidad_entregada_ud: null,
                            estado_entrega: null,
                            observaciones_entrega: null,
                            movimiento_entrada_id: null,
                            gasto_id: null,
                            gasto_otros_id: null
                        })
                        .eq('id', pedidoAcopio.id);

                    const gastosModel = require('../models/gastos');
                    if (pedidoAcopio.gasto_otros_id) await gastosModel.delete(pedidoAcopio.gasto_otros_id);
                    if (pedidoAcopio.gasto_id) await gastosModel.delete(pedidoAcopio.gasto_id);
                }
            }

            // ── 3. Eliminar deudas asociadas automáticamente ──────────────────
            const { data: deudasRelacionadas } = await supabase
                .from('deudas')
                .select('id')
                .eq('movimiento_salida_id', id);

            if (deudasRelacionadas && deudasRelacionadas.length > 0) {
                const deudasModel = require('../models/deudas');
                for (const deuda of deudasRelacionadas) {
                    // Eliminar pagos parciales primero
                    await supabase.from('deuda_pagos_parciales').delete().eq('deuda_id', deuda.id);
                    await deudasModel.delete(deuda.id);
                }
            }

            // ── 4. Eliminar gastos asociados automáticamente ──────────────────
            const { data: gastosRelacionados } = await supabase
                .from('gastos')
                .select('id')
                .eq('movimiento_entrada_id', id);

            if (gastosRelacionados && gastosRelacionados.length > 0) {
                const gastosModel = require('../models/gastos');
                for (const gasto of gastosRelacionados) {
                    await gastosModel.delete(gasto.id);
                }
            }

            // ── 5. Anular el movimiento ────────────────────────────────────────
            const result = await movimientosAlmacen.anularFast(id);
            if (!result.success) throw new Error(result.message);
            return { success: true, message: 'Movimiento anulado correctamente', data: result.data };
        }, { validateId: true, checkPermission: 'anular', passRawResult: true });
    }

    // Eliminar movimiento
    static async eliminar(req, res) {
        return movimientosAlmacenController._handleRequest(res, 'eliminar', req, async () => {
            const { id } = req.params;

            // Verificar si el movimiento está asociado a un pedido
            const { data: pedidoRelacionado, error: pedidoError } = await require('../config/supabase').supabase
                .from('pedidos_almacen')
                .select('id, movimiento_salida_id, movimiento_entrada_id')
                .or(`movimiento_salida_id.eq.${id},movimiento_entrada_id.eq.${id}`)
                .limit(1)
                .maybeSingle();

            if (pedidoRelacionado) {
                if (pedidoRelacionado.movimiento_salida_id == id) {
                    return { success: false, message: 'El movimiento está asociado a un pedido. Debe cancelar la entrega del pedido.' };
                }
                if (pedidoRelacionado.movimiento_entrada_id == id) {
                    return { success: false, message: 'El movimiento está asociado a un pedido. Debe cancelar el ingreso del pedido.' };
                }
            }

            const result = await movimientosAlmacen.eliminar(id);
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
