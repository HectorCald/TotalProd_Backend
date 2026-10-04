const { supabase } = require('../../../config/supabase');
const deudas = require('../../deudas/deudas');
const { aplicarFiltroFecha } = require('../../../utils/fechaRangeHelper');

class movimientosAlmacen {

    // Obtener todos los movimientos de una sucursal
    static async getAll(sucuId, page = 1, limit = 30, tipo = null, estado = null, ordenamiento = 'fecha_desc', search = null, clienteId = null, filtroFecha = null) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:suppliers(id, name),
                    precio:prices_types(id, name),
                    sucursal:sucu_id(id, name),
                    user:user_id(id, first_name, last_name),
                    personal:personal_id(id, first_name, last_name)
                `, { count: 'estimated' })
                .eq('sucu_id', sucuId);

            // Si hay búsqueda por nombre de producto, prefiltrar por IDs de movimientos que tengan ese producto en el detalle
            let movimientosIdsFiltrados = null;
            if (search && search.trim() !== '') {
                const term = `%${search}%`;
                // 1) Buscar productos por nombre en products_almacen
                const { data: productosMatches, error: prodErr } = await supabase
                    .from('products_almacen')
                    .select('id, name')
                    .ilike('name', term);
                if (prodErr) {
                    console.error('[MovAlmacenModel.getAll] products search error =>', prodErr);
                } else {
                    const productIds = (productosMatches || []).map(p => p.id);
                    console.log('[MovAlmacenModel.getAll] products search =>', { term, productIds: productIds.length });
                    if (productIds.length === 0) {
                        return {
                            success: true,
                            data: [],
                            pagination: { total: 0, page, limit, hasNextPage: false }
                        };
                    }
                    // 2) Buscar en detalle movimientos que contengan esos productos
                    const { data: detalleMatches, error: detalleErr } = await supabase
                        .from('movimiento_almacen_producto')
                        .select('movimiento_almacen_id')
                        .in('producto_almacen_id', productIds);
                    if (detalleErr) {
                        console.error('[MovAlmacenModel.getAll] detalle match error =>', detalleErr);
                    } else {
                        movimientosIdsFiltrados = Array.from(new Set((detalleMatches || []).map(d => d.movimiento_almacen_id)));
                        console.log('[MovAlmacenModel.getAll] detalle IDs =>', { ids: movimientosIdsFiltrados.length });
                        if (movimientosIdsFiltrados.length === 0) {
                            return {
                                success: true,
                                data: [],
                                pagination: { total: 0, page, limit, hasNextPage: false }
                            };
                        }
                        query = query.in('id', movimientosIdsFiltrados);
                    }
                }
            }

            // Aplicar filtro de tipo si se proporciona
            if (tipo) {
                query = query.eq('type', tipo);
            }

            // Aplicar filtro de estado si se proporciona
            if (estado) {
                query = query.eq('estado', estado);
            }

            // Aplicar filtro de cliente si se proporciona
            if (clienteId) {
                query = query.eq('cliente_id', clienteId);
            }

            // Aplicar filtro de fecha si se proporciona (incluyendo el día completo en zona horaria local)
            query = aplicarFiltroFecha(query, 'fecha', filtroFecha);

            // Aplicar ordenamiento
            const ascending = ordenamiento === 'fecha_asc';
            query = query.order('fecha', { ascending });

            const { data: movimientos, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                return { success: false, message: 'Error al obtener movimientos', error };
            }

            // Si no hay movimientos, retornar array vacío
            if (!movimientos || movimientos.length === 0) {
                return {
                    success: true,
                    data: [],
                    pagination: {
                        total: count || 0,
                        page,
                        limit,
                        hasNextPage: false
                    }
                };
            }

            const movimientoIds = movimientos.map(m => m.id);

            let todosLosProductos = [];
            if (movimientoIds.length > 0) {
                // Hacer peticiones paralelas para no tardar 20 segundos y evitar el error de Supabase
                const chunkSize = 15;
                const promesas = [];
                for (let i = 0; i < movimientoIds.length; i += chunkSize) {
                    const chunkIds = movimientoIds.slice(i, i + chunkSize);
                    promesas.push(
                        supabase
                            .from('movimiento_almacen_producto')
                            .select('movimiento_almacen_id, precio_unitario, cantidad, producto:producto_almacen_id(name, costo_produccion, grup)')
                            .in('movimiento_almacen_id', chunkIds)
                    );
                }
                const resultados = await Promise.all(promesas);
                for (const { data } of resultados) {
                    if (data) todosLosProductos.push(...data);
                }
            }

            let movimientosConProductos = movimientos.map(mov => {
                const user = mov.user ? { id: mov.user.id, name: `${mov.user.first_name || ''} ${mov.user.last_name || ''}`.trim() } : null;
                const personal = mov.personal ? { id: mov.personal.id, name: `${mov.personal.first_name || ''} ${mov.personal.last_name || ''}`.trim() } : null;
                const movProductos = todosLosProductos.filter(p => p.movimiento_almacen_id === mov.id);

                const calculateSpecialPrice = (precioBase, grup, esAgrupado, esVenta) => {
                    const isActuallyGrouped = esAgrupado && Number(grup) > 0;
                    const precioCrudo = isActuallyGrouped ? (Number(precioBase) * Number(grup)) : Number(precioBase);
                    return precioCrudo;
                };

                const calculateSubtotal = (cantidad, precioBase, grup, esAgrupado, esVenta) => {
                    const precio = calculateSpecialPrice(precioBase, grup, esAgrupado, esVenta);
                    const isActuallyGrouped = esAgrupado && Number(grup) > 0;
                    const precioUnitarioFinal = isActuallyGrouped ? (precio / Number(grup)) : precio;
                    return precioUnitarioFinal * Number(cantidad || 0);
                };

                const subtotal = movProductos.reduce((sum, p) => {
                    const esAgrupado = !!mov.agrupado;
                    const esVenta = mov.type === 'salida' || mov.tipo === 'salida';
                    const grup = p.producto?.grup;
                    const prodSubtotal = calculateSubtotal(p.cantidad, p.precio_unitario, grup, esAgrupado, esVenta);
                    return sum + prodSubtotal;
                }, 0);

                return {
                    ...mov,
                    user,
                    personal,
                    subtotal,
                    productos: movProductos
                };
            });


            return {
                success: true,
                data: movimientosConProductos,
                pagination: {
                    total: search ? movimientosConProductos.length : count,
                    page,
                    limit,
                    hasNextPage: search ? false : count > offset + limit
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getAll:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener todos los movimientos sin límite (Optimizado para reportes/balance)
    static async getAllSinLimite(sucuId, tipo = null, filtroFecha = null, estado = null) {
        try {
            let query = supabase
                .from('movimientos_almacen')
                .select('id, fecha, metodo_pago, type, estado, descuento, aumento, porcentaje, agrupado')
                .eq('sucu_id', sucuId);

            if (tipo) query = query.eq('type', tipo);
            if (estado) query = query.eq('estado', estado);

            query = aplicarFiltroFecha(query, 'fecha', filtroFecha);
            query = query.order('fecha', { ascending: false });

            const { data: movimientos, error } = await query;
            if (error) return { success: false, message: 'Error al obtener movimientos sin limite', error };
            if (!movimientos || movimientos.length === 0) return { success: true, data: [] };

            const movimientoIds = movimientos.map(m => m.id);

            let todosLosProductos = [];
            const chunkSize = 50;
            const promesas = [];
            for (let i = 0; i < movimientoIds.length; i += chunkSize) {
                const chunkIds = movimientoIds.slice(i, i + chunkSize);
                promesas.push(
                    supabase
                        .from('movimiento_almacen_producto')
                        .select('movimiento_almacen_id, precio_unitario, cantidad, producto:producto_almacen_id(costo_produccion, grup)')
                        .in('movimiento_almacen_id', chunkIds)
                );
            }
            const resultados = await Promise.all(promesas);
            for (const { data } of resultados) {
                if (data) todosLosProductos.push(...data);
            }

            const resultadoOptimizado = movimientos.map(mov => {
                const movProductos = todosLosProductos.filter(p => p.movimiento_almacen_id === mov.id);

                const calculateSpecialPrice = (precioBase, grup, esAgrupado, esVenta) => {
                    const precioCrudo = esAgrupado ? (Number(precioBase) * Number(grup || 1)) : Number(precioBase);
                    return precioCrudo;
                };

                const calculateSubtotal = (cantidad, precioBase, grup, esAgrupado, esVenta) => {
                    const precio = calculateSpecialPrice(precioBase, grup, esAgrupado, esVenta);
                    const precioUnitarioFinal = esAgrupado ? (precio / Number(grup || 1)) : precio;
                    return precioUnitarioFinal * Number(cantidad || 0);
                };

                const total = movProductos.reduce((sum, p) => {
                    const esAgrupado = !!mov.agrupado;
                    const esVenta = mov.type === 'salida' || mov.tipo === 'salida';
                    const grup = p.producto?.grup;
                    const prodSubtotal = calculateSubtotal(p.cantidad, p.precio_unitario, grup, esAgrupado, esVenta);
                    return sum + (prodSubtotal || 0);
                }, 0);
                const costo_produccion_total = movProductos.reduce((sum, p) => sum + ((parseFloat(p.producto?.costo_produccion) || 0) * (parseFloat(p.cantidad) || 0)), 0);

                return {
                    id: mov.id,
                    fecha: mov.fecha,
                    metodo_pago: mov.metodo_pago,
                    type: mov.type,
                    estado: mov.estado,
                    descuento: mov.descuento,
                    aumento: mov.aumento,
                    porcentaje: mov.porcentaje,
                    total: total,
                    costo_produccion: costo_produccion_total
                };
            });

            return { success: true, data: resultadoOptimizado };
        } catch (error) {
            console.error('Error en MovimientosAlmacen.getAllSinLimite:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener movimiento por ID con detalles
    static async getById(id) {
        try {
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name, total_orders),
                    proveedor:suppliers(id, name, total_orders),
                    precio:prices_types(id, name),
                    sucursal:sucu_id(id, name),
                    user:user_id(id, first_name, last_name),
                    personal:personal_id(id, first_name, last_name)
                `)
                .eq('id', id)
                .single();

            if (movimientoError) {
                return { success: false, message: 'Movimiento no encontrado', error: movimientoError };
            }

            // Hacer llamadas paralelas para los productos y relaciones
            const [
                { data: productos, error: productosError },
                { data: gastosAsociados },
                { data: pedidosAsociados },
                { data: deudasAsociadas }
            ] = await Promise.all([
                supabase
                    .from('movimiento_almacen_producto')
                    .select(`
                        *,
                        producto:producto_almacen_id(
                            id, 
                            name, 
                            description,
                            grup
                        )
                    `)
                    .eq('movimiento_almacen_id', id),
                supabase.from('gastos').select('id, movimiento_entrada_id').eq('movimiento_entrada_id', id),
                supabase.from('pedidos_almacen').select('id, codigo, numero_pedido, movimiento_entrada_id, movimiento_salida_id').or(`movimiento_entrada_id.eq.${id},movimiento_salida_id.eq.${id}`),
                supabase.from('deudas').select('id, movimiento_salida_id').eq('movimiento_salida_id', id)
            ]);

            if (productosError) {
                console.error('Error obteniendo productos del movimiento:', productosError);
            }

            // Obtener stock en lote (batch) para eliminar consulta N+1
            const productIds = (productos || []).map(p => p.producto?.id).filter(Boolean);
            let stocksMap = new Map();

            if (productIds.length > 0) {
                const { data: stocksActuales } = await supabase
                    .from('productos_sucursal')
                    .select('producto_id, stock')
                    .eq('sucursal_id', movimiento.sucu_id)
                    .in('producto_id', productIds);

                if (stocksActuales) {
                    stocksActuales.forEach(s => stocksMap.set(s.producto_id, s.stock));
                }
            }

            const productosConStock = (productos || []).map(productoMovimiento => ({
                ...productoMovimiento,
                producto: {
                    ...productoMovimiento.producto,
                    stock: stocksMap.get(productoMovimiento.producto.id) || 0
                }
            }));

            // Formatear nombres de usuario y personal
            const user = movimiento.user ? {
                id: movimiento.user.id,
                name: `${movimiento.user.first_name || ''} ${movimiento.user.last_name || ''}`.trim()
            } : null;

            const personal = movimiento.personal ? {
                id: movimiento.personal.id,
                name: `${movimiento.personal.first_name || ''} ${movimiento.personal.last_name || ''}`.trim()
            } : null;

            // Procesar pedidos
            const tienePedidoRelacionado = !!(pedidosAsociados && pedidosAsociados.length > 0);
            let pedidosEntrada = [];
            let pedidosSalida = [];

            if (pedidosAsociados) {
                pedidosEntrada = pedidosAsociados.filter(p => p.movimiento_entrada_id === id);
                pedidosSalida = pedidosAsociados.filter(p => p.movimiento_salida_id === id);
            }

            return {
                success: true,
                data: {
                    ...movimiento,
                    productos: productosConStock,
                    user,
                    personal,
                    gastos: gastosAsociados && gastosAsociados.length > 0 ? gastosAsociados : null,
                    pedidos_entrada: pedidosEntrada.length > 0 ? pedidosEntrada : null,
                    pedidos_salida: pedidosSalida.length > 0 ? pedidosSalida : null,
                    deudas: deudasAsociadas && deudasAsociadas.length > 0 ? deudasAsociadas : null,
                    tiene_pedido_relacionado: tienePedidoRelacionado
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getById:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Inserción de movimiento
    static async create(movimientoData) {
        try {
            const {
                user_id,
                personal_id,
                sucu_id,
                type,
                metodo_pago,
                cliente_id,
                proveedor_id,
                precio_id,
                productos,
                descuento,
                aumento,
                concepto,
                porcentaje,
                agrupado,
                restar_ingredientes,
                fecha,
                produccion_damabrava_id,
                observaciones,
                numero_orden,
                ubicacion
            } = movimientoData;

            let numeroOrdenFinal = null;

            if (type === 'salida' && cliente_id) {
                const { data: cliente } = await supabase.from('clients').select('name, total_orders').eq('id', cliente_id).single();
                if (cliente) {
                    numeroOrdenFinal = (cliente.total_orders || 0) + 1;
                    await supabase.from('clients').update({ total_orders: numeroOrdenFinal }).eq('id', cliente_id);
                }
            } else if (type === 'entrada' && proveedor_id) {
                const { data: proveedor } = await supabase.from('suppliers').select('name, total_orders').eq('id', proveedor_id).single();
                if (proveedor) {
                    numeroOrdenFinal = (proveedor.total_orders || 0) + 1;
                    await supabase.from('suppliers').update({ total_orders: numeroOrdenFinal }).eq('id', proveedor_id);
                }
            }

            const prefix = type === 'entrada' ? 'MAE-' : 'MAV-';
            const genAlfanumerico = () => {
                const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                const nums = '0123456789';
                const l = () => letras[Math.floor(Math.random() * letras.length)];
                const n = () => nums[Math.floor(Math.random() * nums.length)];
                return `${l()}${l()}${n()}${n()}${n()}`;
            };
            const codigoMovimiento = `${prefix}${genAlfanumerico()}`;

            let fechaMovimientoISO = new Date().toISOString();
            if (fecha) {
                if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
                    fechaMovimientoISO = new Date(fecha + 'T12:00:00Z').toISOString();
                } else {
                    const parsed = new Date(fecha);
                    if (!isNaN(parsed.getTime())) {
                        fechaMovimientoISO = parsed.toISOString();
                    }
                }
            }

            const insertData = {
                sucu_id,
                type,
                metodo_pago: metodo_pago || null,
                cliente_id: cliente_id || null,
                proveedor_id: proveedor_id || null,
                precio_id: precio_id || null,
                user_id: user_id || null,
                personal_id: personal_id || null,
                descuento: parseFloat(descuento) || 0,
                aumento: parseFloat(aumento) || 0,
                concepto: concepto || null,
                porcentaje: !!porcentaje,
                agrupado: !!agrupado,
                fecha: fechaMovimientoISO,
                estado: 'finalizado',
                numero_orden: numero_orden !== undefined && numero_orden !== null ? numero_orden : numeroOrdenFinal,
                codigo: codigoMovimiento,
                restar_ingredientes: !!restar_ingredientes,
                produccion_damabrava_id: produccion_damabrava_id || null,
                observaciones: observaciones || null,
                ubicacion: ubicacion || null
            };

            // 1. Insertar movimiento
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .insert(insertData)
                .select('id')
                .single();

            if (movimientoError) {
                console.error('❌ Supabase error en create:', JSON.stringify(movimientoError));
                console.error('❌ insertData:', JSON.stringify(insertData));
                return { success: false, message: 'Error al crear el movimiento', error: movimientoError, detail: movimientoError?.message };
            }

            // 2. Insertar productos del movimiento
            const productosData = productos.map(producto => {
                const precio = Number(producto.precio) || 0;
                const cantidad = Number(producto.cantidad);
                return {
                    movimiento_almacen_id: movimiento.id,
                    producto_almacen_id: producto.id,
                    cantidad: cantidad,
                    precio_unitario: precio
                };
            });

            const { error: productosError } = await supabase
                .from('movimiento_almacen_producto')
                .insert(productosData);

            if (productosError) {
                await supabase.from('movimientos_almacen').delete().eq('id', movimiento.id);
                return { success: false, message: 'Error al crear detalles de productos', error: productosError };
            }

            // 3. Obtener stock actual de la sucursal para estos productos
            const productIds = productos.map(p => p.id);
            const { data: stocksActuales, error: errorStocks } = await supabase
                .from('productos_sucursal')
                .select('id, producto_id, stock')
                .eq('sucursal_id', sucu_id)
                .in('producto_id', productIds);

            if (errorStocks) {
                return { success: false, message: 'Error al obtener stocks para actualizar', error: errorStocks };
            }

            const stocksMap = new Map();
            stocksActuales.forEach(s => stocksMap.set(s.producto_id, s));

            // 4. Preparar upserts de stock
            const upserts = [];
            for (const producto of productos) {
                const stockActual = stocksMap.get(producto.id);
                const stockActualValue = stockActual ? Number(stockActual.stock) : 0;

                let nuevaCantidad;
                if (type === 'entrada') {
                    nuevaCantidad = stockActualValue + Number(producto.cantidad);
                } else {
                    nuevaCantidad = stockActualValue - Number(producto.cantidad);
                }

                upserts.push({
                    producto_id: producto.id,
                    sucursal_id: sucu_id,
                    stock: nuevaCantidad
                });
            }

            if (upserts.length > 0) {
                const { error: upsertError } = await supabase
                    .from('productos_sucursal')
                    .upsert(upserts, { onConflict: 'producto_id, sucursal_id' });

                if (upsertError) {
                    return { success: false, message: 'Error actualizando stocks', error: upsertError };
                }
            }

            // 5. Consumir ingredientes de la receta si corresponde
            if (type === 'entrada' && restar_ingredientes) {
                try {
                    const productoIds = productos.map(p => p.id);

                    // Una sola query para todas las recetas de todos los productos
                    const { data: todasLasRecetas, error: recetasError } = await supabase
                        .from('recetas')
                        .select(`
                            producto_almacen_id,
                            recetas_detalle (
                                id,
                                cantidad,
                                products_acopio:producto_acopio_id (
                                    id,
                                    name,
                                    quantity
                                )
                            )
                        `)
                        .in('producto_almacen_id', productoIds);

                    if (recetasError) throw new Error(recetasError.message);

                    const recetasPorProducto = new Map();
                    (todasLasRecetas || []).forEach(r => recetasPorProducto.set(r.producto_almacen_id, r));

                    const ingredientesParaRestar = [];
                    for (const producto of productos) {
                        const receta = recetasPorProducto.get(producto.id);
                        if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                            ingredientesParaRestar.push({
                                cantidad: Number(producto.cantidad),
                                ingredientes: receta.recetas_detalle
                            });
                        }
                    }

                    if (ingredientesParaRestar.length > 0) {
                        const resultadoBatch = await this.restarIngredientesBatch(ingredientesParaRestar, null);

                        if (!resultadoBatch.success) {
                            // Rollback: eliminar movimiento y revertir stock
                            await supabase.from('movimiento_almacen_producto').delete().eq('movimiento_almacen_id', movimiento.id);
                            await supabase.from('movimientos_almacen').delete().eq('id', movimiento.id);

                            // Revertir stock
                            const rollbackStocks = productos.map(producto => {
                                const stockActual = stocksMap.get(producto.id);
                                if (stockActual) {
                                    return supabase.from('productos_sucursal').update({ stock: Number(stockActual.stock) }).eq('id', stockActual.id);
                                } else {
                                    return supabase.from('productos_sucursal').delete().eq('producto_id', producto.id).eq('sucursal_id', sucu_id);
                                }
                            });
                            await Promise.all(rollbackStocks);

                            return { success: false, message: resultadoBatch.message };
                        }
                    }
                } catch (errorReceta) {
                    // Rollback: eliminar movimiento y revertir stock
                    await supabase.from('movimiento_almacen_producto').delete().eq('movimiento_almacen_id', movimiento.id);
                    await supabase.from('movimientos_almacen').delete().eq('id', movimiento.id);

                    const rollbackStocks = productos.map(producto => {
                        const stockActual = stocksMap.get(producto.id);
                        if (stockActual) {
                            return supabase.from('productos_sucursal').update({ stock: Number(stockActual.stock) }).eq('id', stockActual.id);
                        } else {
                            return supabase.from('productos_sucursal').delete().eq('producto_id', producto.id).eq('sucursal_id', sucu_id);
                        }
                    });
                    await Promise.all(rollbackStocks);

                    return { success: false, message: 'Error al consumir receta: ' + errorReceta.message };
                }
            }

            return await movimientosAlmacen.getById(movimiento.id);
        } catch (error) {
            console.error('Error en MovimientosAlmacen.create:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Eliminar un movimiento
    static async delete(movimientoId) {
        try {
            // Verificar que el movimiento existe
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .select('id, estado, deuda_id')
                .eq('id', movimientoId)
                .maybeSingle();

            if (movimientoError) {
                console.error('Error obteniendo movimiento:', movimientoError);
                return { success: false, message: 'Movimiento no encontrado' };
            }

            if (!movimiento) {
                return { success: false, message: 'Movimiento no encontrado' };
            }

            // Verificar que esté anulado
            if (movimiento.estado !== 'anulado') {
                return { success: false, message: 'Solo se pueden eliminar movimientos anulados' };
            }

            // Eliminar deudas asociadas primero
            try {
                const { data: deudasRelacionadas } = await supabase
                    .from('deudas')
                    .select('id')
                    .eq('movimiento_salida_id', movimientoId);

                if (deudasRelacionadas && deudasRelacionadas.length > 0) {
                    for (const d of deudasRelacionadas) {
                        await supabase.from('deuda_pagos_parciales').delete().eq('deuda_id', d.id);
                        await deudas.delete(d.id);
                    }
                }
            } catch (e) {
                console.warn('⚠️ [ELIMINAR] Error eliminando deudas asociadas al movimiento:', e.message);
                // Continuar con la eliminación del movimiento
            }

            // Usar función RPC para eliminación atómica
            try {
                const { error: rpcError } = await supabase.rpc('eliminar_movimiento_atomico', {
                    movimiento_id: movimientoId
                });

                if (rpcError) {
                    throw rpcError;
                }
            } catch (rpcError) {
                console.warn('RPC eliminar_movimiento_atomico no disponible, usando método tradicional:', rpcError.message);

                // Fallback: método tradicional
                const { error: productosError } = await supabase
                    .from('movimiento_almacen_producto')
                    .delete()
                    .eq('movimiento_almacen_id', movimientoId);

                if (productosError) {
                    console.error('Error eliminando productos del movimiento:', productosError);
                    return { success: false, message: 'Error al eliminar los productos del movimiento' };
                }

                const { error: deleteError } = await supabase
                    .from('movimientos_almacen')
                    .delete()
                    .eq('id', movimientoId);

                if (deleteError) {
                    console.error('Error eliminando movimiento:', deleteError);
                    return { success: false, message: 'Error al eliminar el movimiento' };
                }
            }

            return {
                success: true,
                message: 'Movimiento eliminado correctamente'
            };

        } catch (error) {
            console.error('Error en eliminar movimiento:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    // Anular un movimiento revirtiendo stock
    static async anular(movimientoId) {
        try {
            // Obtener el movimiento
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .select('id, sucu_id, type, estado, cliente_id, proveedor_id, restar_ingredientes, produccion_damabrava_id')
                .eq('id', movimientoId)
                .maybeSingle();

            if (movimientoError) {
                return { success: false, message: 'Movimiento no encontrado' };
            }

            if (!movimiento) {
                return { success: false, message: 'Movimiento no encontrado' };
            }

            if (movimiento.estado === 'anulado') {
                return { success: false, message: 'El movimiento ya está anulado' };
            }

            // Actualizar a estado anulado y limpiar la referencia
            const { error: updateError } = await supabase
                .from('movimientos_almacen')
                .update({ estado: 'anulado', produccion_damabrava_id: null })
                .eq('id', movimientoId);

            if (updateError) {
                return { success: false, message: 'Error al actualizar el estado del movimiento' };
            }

            // Obtener productos del movimiento
            const { data: productos, error: productosError } = await supabase
                .from('movimiento_almacen_producto')
                .select('cantidad, producto_almacen_id')
                .eq('movimiento_almacen_id', movimientoId);

            if (productosError || !productos || productos.length === 0) {
                return { success: true, message: 'Movimiento anulado correctamente (sin productos)' };
            }

            // Si el movimiento tiene produccion_damabrava_id, manejar la anulación especial
            if (movimiento.produccion_damabrava_id) {
                const { data: registroProduccion, error: registroError } = await supabase
                    .from('registros_produccion_damabrava')
                    .select('id, estado, cantidad_ingresada, cantidad_verificada')
                    .eq('id', movimiento.produccion_damabrava_id)
                    .single();

                if (registroError) {
                    console.error('Error obteniendo registro de producción en anular:', registroError);
                    return { success: false, message: 'Error al obtener el registro de producción relacionado' };
                }

                if (registroProduccion) {
                    const cantidadTotalMovimiento = productos.reduce((total, producto) => {
                        return total + parseFloat(producto.cantidad);
                    }, 0);

                    const nuevaCantidadIngresada = Math.max(0, (registroProduccion.cantidad_ingresada || 0) - cantidadTotalMovimiento);

                    let nuevoEstado = registroProduccion.estado;
                    if (registroProduccion.estado === 'Ingresado' && nuevaCantidadIngresada < registroProduccion.cantidad_verificada) {
                        nuevoEstado = 'verificado';
                    }

                    const { error: updateRegistroError } = await supabase
                        .from('registros_produccion_damabrava')
                        .update({
                            cantidad_ingresada: nuevaCantidadIngresada,
                            estado: nuevoEstado
                        })
                        .eq('id', movimiento.produccion_damabrava_id);

                    if (updateRegistroError) {
                        console.error('Error actualizando registro de producción en anular:', updateRegistroError);
                        return { success: false, message: 'Error al actualizar el registro de producción' };
                    }
                    console.log(`Registro de producción ${movimiento.produccion_damabrava_id} actualizado (anular): cantidad_ingresada=${nuevaCantidadIngresada}, estado=${nuevoEstado}`);
                }
            }

            // Revertir el stock en la sucursal de donde se hizo el movimiento
            const productIds = productos.map(p => p.producto_almacen_id);
            const { data: stocksActuales, error: errorStocks } = await supabase
                .from('productos_sucursal')
                .select('id, producto_id, stock')
                .eq('sucursal_id', movimiento.sucu_id)
                .in('producto_id', productIds);

            if (errorStocks) {
                return { success: false, message: 'Error al obtener stocks para revertir', error: errorStocks };
            }

            const stocksMap = new Map();
            stocksActuales.forEach(s => stocksMap.set(s.producto_id, s));

            const upserts = [];
            for (const producto of productos) {
                const stockActual = stocksMap.get(producto.producto_almacen_id);
                const stockActualValue = stockActual ? Number(stockActual.stock) : 0;

                let nuevaCantidad;
                if (movimiento.type === 'entrada') {
                    // Si era entrada y anulamos, restamos
                    nuevaCantidad = stockActualValue - Number(producto.cantidad);
                } else {
                    // Si era salida y anulamos, sumamos
                    nuevaCantidad = stockActualValue + Number(producto.cantidad);
                }

                upserts.push({
                    producto_id: producto.producto_almacen_id,
                    sucursal_id: movimiento.sucu_id,
                    stock: nuevaCantidad
                });
            }

            if (upserts.length > 0) {
                const { error: upsertError } = await supabase.from('productos_sucursal').upsert(upserts, { onConflict: 'producto_id, sucursal_id' });
                if (upsertError) {
                    return { success: false, message: 'Error al revertir stock de los productos' };
                }
            }

            // Si es entrada y consumió ingredientes, devolverlos
            if (movimiento.type === 'entrada' && movimiento.restar_ingredientes) {
                const productIdsConReceta = productos.map(p => p.producto_almacen_id);
                const { data: productosConReceta, error: errorRecetas } = await supabase
                    .from('products_almacen')
                    .select('id, recetas!left(id, recetas_detalle(cantidad, products_acopio(id, name, quantity)))')
                    .in('id', productIdsConReceta);

                if (!errorRecetas && productosConReceta) {
                    const productosMap = new Map();
                    productosConReceta.forEach(p => productosMap.set(p.id, p));

                    const ingredientesParaDevolver = [];
                    for (const producto of productos) {
                        const prodData = productosMap.get(producto.producto_almacen_id);
                        if (prodData && prodData.recetas && prodData.recetas.length > 0) {
                            const receta = prodData.recetas[0];
                            if (receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                                ingredientesParaDevolver.push({
                                    cantidad: Number(producto.cantidad),
                                    ingredientes: receta.recetas_detalle
                                });
                            }
                        }
                    }

                    if (ingredientesParaDevolver.length > 0) {
                        await this.devolverIngredientesBatch(ingredientesParaDevolver, null);
                    }
                }
            }

            // Restar 1 al total_orders del cliente si existe
            if (movimiento.cliente_id) {
                const { data: cliente } = await supabase
                    .from('clients')
                    .select('total_orders')
                    .eq('id', movimiento.cliente_id)
                    .single();
                if (cliente) {
                    const nuevoTotal = Math.max(0, (cliente.total_orders || 0) - 1);
                    await supabase.from('clients').update({ total_orders: nuevoTotal }).eq('id', movimiento.cliente_id);
                }
            }

            // Restar 1 al total_orders del proveedor si existe
            if (movimiento.proveedor_id) {
                const { data: proveedor } = await supabase
                    .from('suppliers')
                    .select('total_orders')
                    .eq('id', movimiento.proveedor_id)
                    .single();
                if (proveedor) {
                    const nuevoTotal = Math.max(0, (proveedor.total_orders || 0) - 1);
                    await supabase.from('suppliers').update({ total_orders: nuevoTotal }).eq('id', movimiento.proveedor_id);
                }
            }

            return { success: true, message: 'Movimiento anulado correctamente' };
        } catch (error) {
            console.error('Error en anular:', error);
            return { success: false, message: 'Error interno en anular', error };
        }
    }

    // Obtener movimientos por producción Damabrava (OPTIMIZADO - igual que getByCliente)
    static async getByProduccionDamabrava(produccionId, sucuId) {
        try {
            if (!produccionId) {
                throw new Error('ID de la producción es requerido');
            }

            if (!sucuId) {
                throw new Error('ID de la sucursal es requerido');
            }

            // Obtener movimientos de la producción con información básica
            const { data: movimientos, error } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name, total_orders),
                    proveedor:suppliers(id, name, total_orders),
                    precio:prices_types(id, name),
                    sucursal:sucu_id(id, name),
                    user:user_id(id, first_name, last_name),
                    personal:personal_id(id, first_name, last_name)
                `)
                .eq('produccion_damabrava_id', produccionId)
                .eq('sucu_id', sucuId)
                .order('fecha', { ascending: false });

            if (error) {
                console.error('Error obteniendo movimientos por producción Damabrava:', error);
                return { success: false, message: 'Error al obtener movimientos de la producción', error };
            }

            // Si no hay movimientos, retornar array vacío
            if (!movimientos || movimientos.length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            // Hidratación OPTIMIZADA: cargar productos en lotes separados para evitar límite de 1000 líneas
            const movimientoIds = movimientos.map(m => m.id);

            // 1) Primero obtener productos del movimiento SIN relaciones anidadas
            const productosByMovimiento = new Map();
            (movimientoIds || []).forEach(id => productosByMovimiento.set(id, []));

            // Dividir movimientoIds en lotes para evitar límite de Supabase
            const batchSize = 50;
            const productosMovimientoAll = [];

            for (let i = 0; i < movimientoIds.length; i += batchSize) {
                const batchIds = movimientoIds.slice(i, i + batchSize);

                const { data: productosBatch, error: productosError } = await supabase
                    .from('movimiento_almacen_producto')
                    .select(`
                        movimiento_almacen_id,
                        producto_almacen_id,
                        cantidad,
                        precio_unitario
                    `)
                    .in('movimiento_almacen_id', batchIds);

                if (productosError) {
                    console.error(`[MovAlmacenModel.getByProduccionDamabrava] Error obteniendo productos (lote ${Math.floor(i / batchSize) + 1}):`, productosError);
                } else if (productosBatch && Array.isArray(productosBatch)) {
                    productosMovimientoAll.push(...productosBatch);
                }
            }

            // 2) Obtener IDs únicos de productos para cargar sus datos
            const productoIds = [...new Set(productosMovimientoAll.map(p => p.producto_almacen_id))];

            // 3) Cargar productos de almacén en lotes pequeños
            const productosAlmacenMap = new Map();
            const productoBatchSize = 100;

            for (let i = 0; i < productoIds.length; i += productoBatchSize) {
                const batchProductIds = productoIds.slice(i, i + productoBatchSize);

                const { data: productosAlmacenBatch, error: productosAlmacenError } = await supabase
                    .from('products_almacen')
                    .select(`
                        id,
                        name,
                        description,
                        grup
                    `)
                    .in('id', batchProductIds);

                if (productosAlmacenError) {
                    console.error(`[MovAlmacenModel.getByProduccionDamabrava] Error obteniendo productos almacén (lote ${Math.floor(i / productoBatchSize) + 1}):`, productosAlmacenError);
                } else if (productosAlmacenBatch && Array.isArray(productosAlmacenBatch)) {
                    productosAlmacenBatch.forEach(prod => {
                        productosAlmacenMap.set(prod.id, prod);
                    });
                }
            }

            // 4) Combinar productos del movimiento con sus datos de almacén
            productosMovimientoAll.forEach(p => {
                if (p && p.movimiento_almacen_id) {
                    const productoAlmacen = productosAlmacenMap.get(p.producto_almacen_id);
                    const productoCompleto = {
                        ...p,
                        producto: productoAlmacen || null
                    };

                    const arr = productosByMovimiento.get(p.movimiento_almacen_id) || [];
                    arr.push(productoCompleto);
                    productosByMovimiento.set(p.movimiento_almacen_id, arr);
                }
            });

            // Armar respuesta final con productos incluidos
            const movimientosConProductos = movimientos.map(mov => {
                const user = mov.user ? { id: mov.user.id, name: `${mov.user.first_name || ''} ${mov.user.last_name || ''}`.trim() } : null;
                const personal = mov.personal ? { id: mov.personal.id, name: `${mov.personal.first_name || ''} ${mov.personal.last_name || ''}`.trim() } : null;

                return {
                    ...mov,
                    productos: productosByMovimiento.get(mov.id) || [],
                    user,
                    personal
                };
            });

            return {
                success: true,
                data: movimientosConProductos
            };

        } catch (error) {
            console.error('Error en movimientosAlmacen.getByProduccionDamabrava:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener relaciones de un movimiento
    static async getRelations(id, sucu_id) {
        try {
            const [
                { data: productos, error: productosError },
                gastosRes,
                pedidosEntradaRes,
                pedidosSalidaRes,
                deudasRes
            ] = await Promise.all([
                supabase
                    .from('movimiento_almacen_producto')
                    .select(`
                        *,
                        producto:producto_almacen_id(
                            id, 
                            name, 
                            description,
                            grup,
                            costo_produccion
                        )
                    `)
                    .eq('movimiento_almacen_id', id),
                supabase
                    .from('gastos')
                    .select('id, movimiento_entrada_id')
                    .eq('movimiento_entrada_id', id)
                    .limit(1),
                supabase
                    .from('pedidos_almacen')
                    .select('id, codigo, numero_pedido, movimiento_entrada_id, movimiento_salida_id')
                    .eq('movimiento_entrada_id', id)
                    .limit(1),
                supabase
                    .from('pedidos_almacen')
                    .select('id, codigo, numero_pedido, movimiento_entrada_id, movimiento_salida_id')
                    .eq('movimiento_salida_id', id)
                    .limit(1),
                supabase
                    .from('deudas')
                    .select('id, movimiento_salida_id')
                    .eq('movimiento_salida_id', id)
                    .limit(1)
            ]);

            let productosConStock = productos || [];

            // Si hay sucu_id, cargar el stock optimizadamente
            if (sucu_id && productosConStock.length > 0) {
                const productIds = productosConStock.map(p => p.producto?.id).filter(Boolean);
                let stocksMap = new Map();

                if (productIds.length > 0) {
                    const { data: stocksActuales } = await supabase
                        .from('productos_sucursal')
                        .select('producto_id, stock')
                        .eq('sucursal_id', sucu_id)
                        .in('producto_id', productIds);

                    if (stocksActuales) {
                        stocksActuales.forEach(s => stocksMap.set(s.producto_id, s.stock));
                    }
                }

                productosConStock = productosConStock.map(productoMovimiento => ({
                    ...productoMovimiento,
                    producto: {
                        ...productoMovimiento.producto,
                        stock: stocksMap.get(productoMovimiento.producto.id) || 0
                    }
                }));
            }

            const gastos = gastosRes.data || [];
            const pEntrada = pedidosEntradaRes.data || [];
            const pSalida = pedidosSalidaRes.data || [];
            const deudas = deudasRes.data || [];

            return {
                success: true,
                data: {
                    productos: productosConStock,
                    gastos: gastos.length > 0 ? gastos : null,
                    pedidos_entrada: pEntrada.length > 0 ? pEntrada : null,
                    pedidos_salida: pSalida.length > 0 ? pSalida : null,
                    deudas: deudas.length > 0 ? deudas : null
                }
            };
        } catch (error) {
            console.error('Error in getRelations:', error);
            return {
                success: false,
                message: error.message || 'Error fetching relations'
            };
        }
    }

    // Método para restar ingredientes del stock cuando se hace una entrada con receta (Producción)
    static async restarIngredientesProduccion(productoPrincipal, cantidadEntrada, ingredientes, empresaId) {
        try {
            const ingredientesValidos = ingredientes.filter(i => i.products_acopio && i.products_acopio.id);

            if (ingredientesValidos.length === 0) {
                return { success: true, message: 'No hay ingredientes válidos para procesar' };
            }

            const ingredienteIds = ingredientesValidos.map(i => i.products_acopio.id);

            // Consulta bulk para obtener stocks actuales
            const { data: productosActuales, error: fetchError } = await supabase
                .from('products_acopio')
                .select('id, quantity')
                .in('id', ingredienteIds);

            if (fetchError) throw new Error('Error al obtener stocks de ingredientes');

            const stocksActuales = {};
            productosActuales.forEach(p => { stocksActuales[p.id] = p.quantity; });

            const actualizaciones = [];
            const ingredientesConStockInsuficiente = [];

            for (const ingrediente of ingredientesValidos) {
                const cantidadARestar = ingrediente.cantidad * cantidadEntrada;
                const cantidadActual = stocksActuales[ingrediente.products_acopio.id] || 0;
                const nuevaCantidad = cantidadActual - cantidadARestar;

                if (nuevaCantidad < 0) {
                    ingredientesConStockInsuficiente.push(ingrediente.products_acopio.name);
                    continue;
                }

                actualizaciones.push({ id: ingrediente.products_acopio.id, quantity: nuevaCantidad });
            }

            if (ingredientesConStockInsuficiente.length > 0) {
                return {
                    success: false,
                    message: 'No se puede completar la entrada. Algunos ingredientes de la receta no cuentan con stock suficiente en materia prima.'
                };
            }

            if (actualizaciones.length > 0) {
                // Intentar RPC atómica primero
                const { error: rpcError } = await supabase.rpc('update_acopio_stocks_batch', {
                    stock_updates: actualizaciones
                });

                if (rpcError) {
                    // Fallback: updates paralelos
                    const updateResults = await Promise.all(
                        actualizaciones.map(a =>
                            supabase.from('products_acopio').update({ quantity: a.quantity }).eq('id', a.id)
                        )
                    );
                    const errores = updateResults.filter(r => r.error);
                    if (errores.length > 0) throw new Error('Error al actualizar ingredientes');
                }
            }

            return {
                success: true,
                message: 'Ingredientes restados correctamente',
                actualizados: actualizaciones.length
            };
        } catch (error) {
            console.error('Error en restarIngredientesProduccion:', error);
            throw new Error('Error al restar ingredientes del stock');
        }
    }

    // Método batch para restar ingredientes de múltiples productos
    static async restarIngredientesBatch(ingredientesParaRestar, empresaId) {
        try {
            // Recopilar todos los ingredientes únicos de todos los productos
            const ingredientesMap = new Map(); // Para evitar duplicados

            for (const item of ingredientesParaRestar) {
                for (const ingrediente of item.ingredientes) {
                    if (ingrediente.products_acopio && ingrediente.products_acopio.id) {
                        const key = ingrediente.products_acopio.id;

                        if (ingredientesMap.has(key)) {
                            // Si ya existe, sumar las cantidades
                            ingredientesMap.get(key).cantidad += ingrediente.cantidad * item.cantidad;
                        } else {
                            // Si no existe, agregarlo
                            ingredientesMap.set(key, {
                                ...ingrediente,
                                cantidad: ingrediente.cantidad * item.cantidad
                            });
                        }
                    }
                }
            }

            // Convertir map a array
            const ingredientesUnicos = Array.from(ingredientesMap.values());

            if (ingredientesUnicos.length === 0) {
                return { success: true, message: 'No hay ingredientes para procesar' };
            }

            // Usar el método optimizado existente con los ingredientes consolidados
            return await this.restarIngredientesProduccion(
                null, // No necesitamos producto principal para batch
                1, // Ya multiplicamos las cantidades arriba
                ingredientesUnicos,
                empresaId
            );
        } catch (error) {
            console.error('Error en restarIngredientesBatch:', error);
            throw new Error('Error al procesar ingredientes en batch');
        }
    }

    // Método para devolver ingredientes (sumar al stock)
    static async devolverIngredientes(producto, cantidad, ingredientes, empresaId) {
        try {
            const ingredientesValidos = (ingredientes || []).filter(i => i.products_acopio && i.products_acopio.id);

            if (ingredientesValidos.length === 0) {
                return { success: true, message: 'No hay ingredientes válidos para procesar', ingredientesDevueltos: [] };
            }

            const ingredienteIds = ingredientesValidos.map(i => i.products_acopio.id);

            // Consulta bulk para obtener stocks actuales frescos
            const { data: productosActuales, error: fetchError } = await supabase
                .from('products_acopio')
                .select('id, quantity')
                .in('id', ingredienteIds);

            if (fetchError) throw new Error('Error al obtener stocks de ingredientes');

            const stocksActuales = {};
            (productosActuales || []).forEach(p => { stocksActuales[p.id] = Number(p.quantity) || 0; });

            const actualizaciones = [];
            const ingredientesDevueltos = [];

            for (const ingrediente of ingredientesValidos) {
                const cantidadADevolver = (Number(ingrediente.cantidad) || 0) * (Number(cantidad) || 0);
                const stockActual = stocksActuales[ingrediente.products_acopio.id] || 0;
                const nuevaCantidad = stockActual + cantidadADevolver;

                actualizaciones.push({ id: ingrediente.products_acopio.id, quantity: nuevaCantidad });
                ingredientesDevueltos.push({
                    nombre: ingrediente.products_acopio.name,
                    cantidad: cantidadADevolver
                });
            }

            if (actualizaciones.length > 0) {
                // Intentar RPC atómica primero
                const { error: rpcError } = await supabase.rpc('update_acopio_stocks_batch', {
                    stock_updates: actualizaciones
                });

                if (rpcError) {
                    // Fallback: updates paralelos
                    const updateResults = await Promise.all(
                        actualizaciones.map(a =>
                            supabase.from('products_acopio').update({ quantity: a.quantity }).eq('id', a.id)
                        )
                    );
                    const errores = updateResults.filter(r => r.error);
                    if (errores.length > 0) throw new Error('Error al actualizar stock de ingredientes al devolver');
                }
            }

            return {
                success: true,
                message: `Ingredientes devueltos correctamente: ${ingredientesDevueltos.length} ingredientes`,
                ingredientesDevueltos
            };
        } catch (error) {
            console.error('❌ [DEVOLVER INGREDIENTES] Error en devolverIngredientes:', error);
            return {
                success: false,
                message: 'Error interno al devolver ingredientes: ' + error.message
            };
        }
    }

    // Método batch para devolver ingredientes de múltiples productos
    static async devolverIngredientesBatch(ingredientesParaDevolver, empresaId) {
        try {
            const ingredientesMap = new Map();

            for (const item of ingredientesParaDevolver) {
                for (const ingrediente of (item.ingredientes || [])) {
                    if (ingrediente.products_acopio && ingrediente.products_acopio.id) {
                        const key = ingrediente.products_acopio.id;
                        const cant = (Number(ingrediente.cantidad) || 0) * (Number(item.cantidad) || 0);

                        if (ingredientesMap.has(key)) {
                            ingredientesMap.get(key).cantidad += cant;
                        } else {
                            ingredientesMap.set(key, {
                                ...ingrediente,
                                cantidad: cant
                            });
                        }
                    }
                }
            }

            const ingredientesUnicos = Array.from(ingredientesMap.values());

            if (ingredientesUnicos.length === 0) {
                return { success: true, message: 'No hay ingredientes para procesar', ingredientesDevueltos: [] };
            }

            return await this.devolverIngredientes(
                null,
                1,
                ingredientesUnicos,
                empresaId
            );
        } catch (error) {
            console.error('Error en devolverIngredientesBatch:', error);
            return {
                success: false,
                message: 'Error al procesar devolución de ingredientes en batch: ' + error.message
            };
        }
    }
}

module.exports = movimientosAlmacen;