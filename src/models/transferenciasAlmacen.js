const { supabase, retryOperation, processBatch, validateBatchResults } = require('../config/supabase');

class transferenciasAlmacen {
    // Crear una nueva transferencia de almacén
    static async create(transferenciaData) {
        try {
            const { user_id, personal_id, empresa_id, sucu_origen_id, sucu_destino_id, concepto, productos, agrupado, precio_id, cliente_id } = transferenciaData;

            // Iniciar transacción - Insertar transferencia
            const insertData = {
                sucu_origen_id,
                sucu_destino_id,
                concepto: concepto || null,
                estado: 'Finalizado', // Estado inicial: auto-ingresado en destino
                empresa_id,
                precio_id: precio_id, // Requerido según la tabla
                agrupado: typeof agrupado !== 'undefined' ? !!agrupado : false,
                cliente_id: cliente_id || null
            };

            // Solo agregar campos que tienen valor
            if (user_id && user_id !== null) {
                insertData.user_id = user_id;
            }
            if (personal_id && personal_id !== null) {
                insertData.personal_id = personal_id;
            }

            // Insertar transferencia
            const { data: transferencia, error: transferenciaError } = await supabase
                .from('transferencias_almacen')
                .insert(insertData)
                .select(`
                    id, 
                    sucu_origen_id, 
                    sucu_destino_id, 
                    fecha, 
                    estado, 
                    concepto, 
                    precio_id, 
                    agrupado,
                    cliente_id,
                    user_id,
                    personal_id,
                    sucursal_origen:sucu_origen_id(id, name),
                    sucursal_destino:sucu_destino_id(id, name),
                    precio:prices_types(id, name),
                    cliente:cliente_id(id, name, total_orders)
                `)
                .single();

            if (transferenciaError) {
                console.error('Error creando transferencia:', transferenciaError);
                return { success: false, message: 'Error al crear la transferencia', error: transferenciaError };
            }

            // Crear los detalles de productos si existen
            if (productos && productos.length > 0) {
                // Preparar datos de productos de forma eficiente
                const productosData = productos.map(producto => {
                    const precio = Number(producto.precio) || 0;
                    const cantidad = Number(producto.cantidad);
                    return {
                        transferencia_almacen_id: transferencia.id,
                        producto_almacen_id: producto.id,
                        cantidad: cantidad,
                        precio_unitario: precio,
                        subtotal: precio * cantidad
                    };
                });

                // Insertar todos los productos en una sola operación
                const { error: productosError } = await supabase
                    .from('transferencias_almacen_detalle')
                    .insert(productosData)
                    .select('id');

                if (productosError) {
                    console.error('Error creando detalles de productos:', productosError);
                    // Limpieza: eliminar la transferencia si falla la inserción de productos
                    await this.cleanupTransferencia(transferencia.id);
                    return { success: false, message: 'Error al crear los detalles de productos', error: productosError };
                }

                // Actualizar stock de productos después de crear la transferencia
                // Solo restar stock de la sucursal de origen (como una salida)
                // El destino hará el ingreso cuando apruebe la transferencia

                // 1) Obtener todos los stocks actuales de la sucursal de origen en una sola consulta
                const productIds = productos.map(p => p.id);

                const { data: stocksOrigen, error: errorStocksOrigen } = await supabase
                    .from('productos_sucursal')
                    .select('id, producto_id, stock')
                    .eq('sucursal_id', sucu_origen_id)
                    .in('producto_id', productIds)
                    .limit(1000);

                if (errorStocksOrigen) {
                    console.error('Error obteniendo stocks de origen:', errorStocksOrigen);
                    await this.cleanupTransferencia(transferencia.id);
                    return { success: false, message: 'Error al obtener stocks de origen', error: errorStocksOrigen };
                }

                // 2) Crear mapa de stocks para acceso rápido
                const stocksOrigenMap = new Map();
                stocksOrigen.forEach(stock => {
                    stocksOrigenMap.set(stock.producto_id, { id: stock.id, stock: stock.stock });
                });

                // 3) Preparar actualizaciones de stock en origen
                const actualizacionesOrigen = [];

                console.log(`📊 [TRANSFERENCIA] Calculando stocks para ${productos.length} productos (solo origen)`);

                for (const producto of productos) {
                    const stockOrigen = stocksOrigenMap.get(producto.id);
                    const stockOrigenValue = stockOrigen ? stockOrigen.stock : 0;
                    const stockOrigenId = stockOrigen ? stockOrigen.id : null;

                    // Validar stock suficiente en origen
                    if (stockOrigenValue < producto.cantidad) {
                        console.error(`❌ [TRANSFERENCIA] Stock insuficiente en origen para producto ${producto.id}. Stock: ${stockOrigenValue}, Requerido: ${producto.cantidad}`);
                        await this.cleanupTransferencia(transferencia.id);
                        return {
                            success: false,
                            message: `Stock insuficiente en origen para producto ${producto.id}. Stock disponible: ${stockOrigenValue}, Cantidad requerida: ${producto.cantidad}`,
                            error: 'Stock insuficiente',
                            productoId: producto.id,
                            stockDisponible: stockOrigenValue,
                            cantidadRequerida: producto.cantidad
                        };
                    }

                    // Calcular nuevo stock en origen (restar) - como una salida
                    const nuevoStockOrigen = stockOrigenValue - producto.cantidad;
                    console.log(`📦 [ORIGEN] Producto ${producto.id} | ${stockOrigenValue} - ${producto.cantidad} = ${nuevoStockOrigen}`);

                    if (stockOrigenId) {
                        actualizacionesOrigen.push({
                            id: stockOrigenId,
                            stock: nuevoStockOrigen,
                            producto_id: producto.id
                        });
                    }
                }

                // 4) Ejecutar actualizaciones de stock en origen
                if (actualizacionesOrigen.length > 0) {
                    console.log(`🔄 [ORIGEN] Procesando ${actualizacionesOrigen.length} actualizaciones de stock`);
                    
                    try {
                        const rpcResult = await retryOperation(async () => {
                            const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                                stock_updates: actualizacionesOrigen.map(a => ({
                                    id: a.id,
                                    stock: a.stock
                                }))
                            });

                            if (rpcError) {
                                throw rpcError;
                            }

                            return { success: true };
                        });

                        console.log('✅ [ORIGEN] RPC completado exitosamente');

                    } catch (rpcError) {
                        console.warn('⚠️ [ORIGEN] RPC no disponible, usando método por lotes:', rpcError.message);

                        // Fallback: usar método por lotes con control de concurrencia
                        const updateOperations = actualizacionesOrigen.map(actualizacion => 
                            retryOperation(async () => {
                                console.log(`🔄 [ACTUALIZANDO] Producto ${actualizacion.producto_id} | Stock: ${actualizacion.stock}`);
                                
                                const { data, error } = await supabase
                                    .from('productos_sucursal')
                                    .update({ stock: actualizacion.stock })
                                    .eq('id', actualizacion.id)
                                    .select('id');
                                
                                if (error) {
                                    console.error(`❌ [ERROR ACTUALIZACIÓN] Producto ${actualizacion.producto_id} | Error: ${error.message}`);
                                    throw error;
                                }
                                
                                console.log(`✅ [ACTUALIZADO] Producto ${actualizacion.producto_id}`);
                                return { data, error: null };
                            })
                        );
                        
                        // Procesar en lotes de máximo 50 operaciones
                        const { results, errors } = await processBatch(updateOperations, 50);
                        
                        // Validar que todas las operaciones fueron exitosas
                        try {
                            validateBatchResults(results);
                            console.log('✅ [ORIGEN] Todas las actualizaciones completadas exitosamente');
                        } catch (validationError) {
                            console.error('❌ [ORIGEN] Error en validación de resultados:', validationError.message);
                            await this.cleanupTransferencia(transferencia.id);
                            return { 
                                success: false, 
                                message: 'Error al actualizar stocks: ' + validationError.message, 
                                error: validationError 
                            };
                        }
                        
                        // Si hay errores en el procesamiento por lotes, fallar completamente
                        if (errors.length > 0) {
                            console.error('❌ [ORIGEN] Errores en procesamiento por lotes:', errors);
                            await this.cleanupTransferencia(transferencia.id);
                            return { 
                                success: false, 
                                message: 'Error al procesar actualizaciones de stock', 
                                error: errors 
                            };
                        }
                    }
                }

                // 5) AUTO-INGRESAR stock en destino (auto-ingreso inmediato)
                console.log(`🔄 [DESTINO] Auto-ingresando stock en destino`);
                
                // Obtener stocks actuales de la sucursal de destino
                const { data: stocksDestino, error: errorStocksDestino } = await supabase
                    .from('productos_sucursal')
                    .select('id, producto_id, stock')
                    .eq('sucursal_id', sucu_destino_id)
                    .in('producto_id', productIds);

                if (errorStocksDestino) {
                    console.error('Error obteniendo stocks de destino para auto-ingreso:', errorStocksDestino);
                    await this.cleanupTransferencia(transferencia.id);
                    return { success: false, message: 'Error al obtener stocks de destino', error: errorStocksDestino };
                }

                const stocksDestinoMap = new Map();
                stocksDestino.forEach(stock => {
                    stocksDestinoMap.set(stock.producto_id, { id: stock.id, stock: stock.stock });
                });

                const actualizacionesDestino = [];
                for (const producto of productos) {
                    const stockDestino = stocksDestinoMap.get(producto.id);
                    const stockDestinoValue = stockDestino ? stockDestino.stock : 0;
                    const stockDestinoId = stockDestino ? stockDestino.id : null;

                    const nuevoStockDestino = stockDestinoValue + producto.cantidad;
                    console.log(`📦 [DESTINO] Producto ${producto.id} | ${stockDestinoValue} + ${producto.cantidad} = ${nuevoStockDestino}`);

                    if (stockDestinoId) {
                        actualizacionesDestino.push({
                            id: stockDestinoId,
                            stock: nuevoStockDestino,
                            producto_id: producto.id
                        });
                    } else {
                        // Si el producto no existe en la sucursal de destino, insertarlo
                        actualizacionesDestino.push({
                            producto_id: producto.id,
                            sucursal_id: sucu_destino_id,
                            stock: producto.cantidad
                        });
                    }
                }

                if (actualizacionesDestino.length > 0) {
                    try {
                        const rpcResultDestino = await retryOperation(async () => {
                            const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                                stock_updates: actualizacionesDestino
                                    .filter(a => a.id) // Solo los que tienen id (actualizaciones)
                                    .map(a => ({
                                        id: a.id,
                                        stock: a.stock
                                    }))
                            });

                            if (rpcError) {
                                throw rpcError;
                            }

                            return { success: true };
                        });

                        console.log('✅ [DESTINO] RPC completado exitosamente');

                        // Insertar productos nuevos en destino (los que no tienen id)
                        const nuevasInsercionesDestino = actualizacionesDestino.filter(a => !a.id);
                        if (nuevasInsercionesDestino.length > 0) {
                            const { error: insertError } = await supabase
                                .from('productos_sucursal')
                                .insert(nuevasInsercionesDestino.map(a => ({
                                    producto_id: a.producto_id,
                                    sucursal_id: a.sucursal_id,
                                    stock: a.stock
                                })));

                            if (insertError) {
                                console.error('Error insertando productos nuevos en destino:', insertError);
                                await this.cleanupTransferencia(transferencia.id);
                                return { success: false, message: 'Error al insertar productos en destino', error: insertError };
                            }
                        }

                    } catch (rpcError) {
                        console.warn('⚠️ [DESTINO] RPC no disponible, usando método por lotes:', rpcError.message);

                        // Fallback: usar upsert para insertar o actualizar
                        const { error: updateErrorDestino } = await supabase
                            .from('productos_sucursal')
                            .upsert(actualizacionesDestino.map(a => ({
                                id: a.id || undefined,
                                producto_id: a.producto_id,
                                sucursal_id: a.sucursal_id || sucu_destino_id,
                                stock: a.stock
                            })), { onConflict: 'id,producto_id,sucursal_id' });

                        if (updateErrorDestino) {
                            console.error('Error actualizando stocks de destino al auto-ingresar:', updateErrorDestino);
                            await this.cleanupTransferencia(transferencia.id);
                            return { success: false, message: 'Error al actualizar stocks en destino', error: updateErrorDestino };
                        }
                    }
                }

                // 6) El estado ya es "Finalizado" desde la creación (línea 14), no es necesario actualizarlo
                // Solo asegurarnos de que el objeto transferencia tenga el estado correcto
                transferencia.estado = 'Finalizado';
            }

            // Obtener información del usuario o personal si existe
            let user = null;
            let personal = null;

            if (transferencia.user_id) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', transferencia.user_id)
                    .maybeSingle();
                
                if (userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            if (transferencia.personal_id) {
                const { data: personalData } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', transferencia.personal_id)
                    .maybeSingle();
                
                if (personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            return {
                success: true,
                data: {
                    id: transferencia.id,
                    sucu_origen_id: transferencia.sucu_origen_id,
                    sucu_destino_id: transferencia.sucu_destino_id,
                    fecha: transferencia.fecha,
                    estado: transferencia.estado,
                    concepto: transferencia.concepto,
                    precio_id: transferencia.precio_id,
                    agrupado: transferencia.agrupado,
                    sucursal_origen: transferencia.sucursal_origen,
                    sucursal_destino: transferencia.sucursal_destino,
                    precio: transferencia.precio,
                    cliente: transferencia.cliente,
                    cliente_id: transferencia.cliente_id,
                    user,
                    personal
                }
            };

        } catch (error) {
            console.error('Error en TransferenciasAlmacen.create:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener transferencia por ID con detalles
    static async getById(id) {
        try {
            const { data: transferencia, error: transferenciaError } = await supabase
                .from('transferencias_almacen')
                .select(`
                    *,
                    sucursal_origen:sucu_origen_id(id, name),
                    sucursal_destino:sucu_destino_id(id, name),
                    precio:prices_types(id, name),
                    cliente:cliente_id(id, name, total_orders)
                `)
                .eq('id', id)
                .single();

            if (transferenciaError) {
                return { success: false, message: 'Transferencia no encontrada', error: transferenciaError };
            }

            // Obtener productos de la transferencia
            const { data: productos, error: productosError } = await supabase
                .from('transferencias_almacen_detalle')
                .select(`
                    *,
                    producto:producto_almacen_id(
                        id, 
                        name, 
                        description,
                        grup
                    )
                `)
                .eq('transferencia_almacen_id', id);

            if (productosError) {
                console.error('Error obteniendo productos de la transferencia:', productosError);
            }

            // Obtener información del usuario o personal
            let user = null;
            let personal = null;

            if (transferencia.user_id) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', transferencia.user_id)
                    .single();

                if (!userError && userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            if (transferencia.personal_id) {
                const { data: personalData, error: personalError } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', transferencia.personal_id)
                    .single();

                if (!personalError && personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            return {
                success: true,
                data: {
                    ...transferencia,
                    productos: productos || [],
                    user,
                    personal,
                    cliente: transferencia.cliente || null
                }
            };

        } catch (error) {
            console.error('Error en TransferenciasAlmacen.getById:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener todas las transferencias de una sucursal
    static async getAll(sucuId, page = 1, limit = 30, estado = null, ordenamiento = 'fecha_desc', search = null, filtroFecha = null) {
        try {
            // Validar sucuId
            if (!sucuId) {
                return {
                    success: false,
                    message: 'ID de la sucursal es requerido'
                };
            }

            const sanitizedPage = Math.max(parseInt(page, 10) || 1, 1);
            const sanitizedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
            const offset = (sanitizedPage - 1) * sanitizedLimit;
            const searchTerm = typeof search === 'string' ? search.trim() : '';

            // Construir el filtro .or() correctamente para UUIDs
            // NO incluir user y personal en el select porque no hay foreign keys definidas
            let query = supabase
                .from('transferencias_almacen')
                .select(`
                    *,
                    sucursal_origen:sucu_origen_id(id, name),
                    sucursal_destino:sucu_destino_id(id, name),
                    precio:prices_types(id, name),
                    cliente:cliente_id(id, name, total_orders)
                `, { count: 'exact' })
                .or(`sucu_origen_id.eq.${sucuId},sucu_destino_id.eq.${sucuId}`);

            // Aplicar filtro de estado si se proporciona
            if (estado) {
                query = query.eq('estado', estado);
            }

            // Aplicar filtro de fecha si se proporciona
            if (filtroFecha) {
                if (filtroFecha.inicio) {
                    query = query.gte('fecha', filtroFecha.inicio);
                }
                if (filtroFecha.fin) {
                    query = query.lte('fecha', filtroFecha.fin);
                }
            }

            // Aplicar búsqueda si se proporciona
            if (searchTerm) {
                const normalizedSearch = `%${searchTerm}%`;
                const orFilters = [];

                // Buscar en concepto
                orFilters.push(`concepto.ilike.${normalizedSearch}`);

                // Buscar en productos
                const { data: productosMatches, error: productosError } = await supabase
                    .from('products_almacen')
                    .select('id')
                    .or(`name.ilike.${normalizedSearch},description.ilike.${normalizedSearch}`);

                if (!productosError && productosMatches?.length) {
                    const productIds = productosMatches.map(producto => producto.id);
                    if (productIds.length > 0) {
                        const { data: detalleMatches, error: detalleError } = await supabase
                            .from('transferencias_almacen_detalle')
                            .select('transferencia_almacen_id')
                            .in('producto_almacen_id', productIds);

                        if (!detalleError && detalleMatches?.length) {
                            const transferenciaIds = Array.from(new Set(detalleMatches.map(detalle => detalle.transferencia_almacen_id)));
                            if (transferenciaIds.length > 0) {
                                orFilters.push(`id.in.(${transferenciaIds.join(',')})`);
                            }
                        }
                    }
                }

                if (orFilters.length > 0) {
                    query = query.or(orFilters.join(','));
                }
            }

            // Aplicar ordenamiento
            switch (ordenamiento) {
                case 'fecha_asc':
                    query = query.order('fecha', { ascending: true });
                    break;
                default:
                    query = query.order('fecha', { ascending: false });
                    break;
            }

            const { data: transferencias, error, count } = await query.range(offset, offset + sanitizedLimit - 1);

            if (error) {
                console.error('Error en query de transferencias:', error);
                console.error('sucuId usado:', sucuId);
                console.error('Query params:', { page: sanitizedPage, limit: sanitizedLimit, estado, ordenamiento, search: searchTerm, filtroFecha });
                return { success: false, message: 'Error al obtener transferencias', error: error.message || error };
            }

            // Si no hay transferencias, retornar array vacío
            if (!transferencias || transferencias.length === 0) {
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

            // Obtener productos para cada transferencia en lote
            const transferenciaIds = transferencias.map(t => t.id);

            const { data: productosAll } = await supabase
                .from('transferencias_almacen_detalle')
                .select(`
                    transferencia_almacen_id,
                    producto_almacen_id,
                    cantidad,
                    precio_unitario,
                    subtotal,
                    producto:producto_almacen_id(
                        id,
                        name,
                        description,
                        grup
                    )
                `)
                .in('transferencia_almacen_id', transferenciaIds);

            const productosByTransferencia = new Map();
            transferenciaIds.forEach(id => productosByTransferencia.set(id, []));
            (productosAll || []).forEach(p => {
                const arr = productosByTransferencia.get(p.transferencia_almacen_id) || [];
                arr.push(p);
                productosByTransferencia.set(p.transferencia_almacen_id, arr);
            });

            // Obtener nombres de usuarios y personal para cada transferencia (BATCH LOADING)
            // Obtener IDs únicos de usuarios y personal
            const userIds = Array.from(new Set(transferencias.map(t => t.user_id).filter(Boolean)));
            const personalIds = Array.from(new Set(transferencias.map(t => t.personal_id).filter(Boolean)));

            // 1) Usuarios en lote
            const userMap = new Map();
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .in('id', userIds);
                (usersData || []).forEach(u => {
                    userMap.set(u.id, {
                        id: u.id,
                        name: `${u.first_name} ${u.last_name}`.trim()
                    });
                });
            }

            // 2) Personal en lote
            const personalMap = new Map();
            if (personalIds.length > 0) {
                const { data: personalData } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .in('id', personalIds);
                (personalData || []).forEach(p => {
                    personalMap.set(p.id, {
                        id: p.id,
                        name: `${p.first_name} ${p.last_name}`.trim()
                    });
                });
            }

            // Armar respuesta final
            const transferenciasConProductos = transferencias.map(trans => {
                const user = trans.user_id ? (userMap.get(trans.user_id) || null) : null;
                const personal = trans.personal_id ? (personalMap.get(trans.personal_id) || null) : null;

                return {
                    ...trans,
                    productos: productosByTransferencia.get(trans.id) || [],
                    user,
                    personal
                };
            });

            const total = typeof count === 'number' ? count : transferenciasConProductos?.length || 0;
            const hasNextPage = typeof count === 'number'
                ? count > offset + sanitizedLimit
                : (transferenciasConProductos?.length || 0) === sanitizedLimit;

            return {
                success: true,
                data: transferenciasConProductos,
                pagination: {
                    total,
                    page: sanitizedPage,
                    limit: sanitizedLimit,
                    hasNextPage
                }
            };

        } catch (error) {
            console.error('Error en TransferenciasAlmacen.getAll:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Actualizar estado de una transferencia
    static async actualizarEstado(transferenciaId, nuevoEstado) {
        try {
            const estadosPermitidos = ['Transferido', 'Anulado', 'Finalizado'];

            if (!estadosPermitidos.includes(nuevoEstado)) {
                return { success: false, message: 'Estado de transferencia no válido' };
            }

            // Primero obtener la transferencia para verificar el estado actual y obtener datos necesarios
            const { data: transferenciaActual, error: errorTransferenciaActual } = await supabase
                .from('transferencias_almacen')
                .select('id, sucu_origen_id, sucu_destino_id, estado')
                .eq('id', transferenciaId)
                .single();

            if (errorTransferenciaActual || !transferenciaActual) {
                console.error('Error obteniendo transferencia:', errorTransferenciaActual);
                return { success: false, message: 'Transferencia no encontrada', error: errorTransferenciaActual };
            }

            // Si el nuevo estado es 'Anulado', devolver stock al origen y restar del destino
            if (nuevoEstado === 'Anulado' && (transferenciaActual.estado === 'Transferido' || transferenciaActual.estado === 'Finalizado')) {
                // Obtener los productos de la transferencia
                const { data: productosDetalle, error: detalleError } = await supabase
                    .from('transferencias_almacen_detalle')
                    .select('producto_almacen_id, cantidad')
                    .eq('transferencia_almacen_id', transferenciaId);

                if (detalleError) {
                    console.error('Error obteniendo detalles para anular transferencia:', detalleError);
                    return { success: false, message: 'Error al obtener detalles de productos para anular', error: detalleError };
                }

                if (productosDetalle && productosDetalle.length > 0) {
                    const productIds = productosDetalle.map(p => p.producto_almacen_id);

                    // Obtener stocks actuales de la sucursal de origen
                    const { data: stocksOrigen, error: errorStocksOrigen } = await supabase
                        .from('productos_sucursal')
                        .select('id, producto_id, stock')
                        .eq('sucursal_id', transferenciaActual.sucu_origen_id)
                        .in('producto_id', productIds)
                        .limit(1000);

                    if (errorStocksOrigen) {
                        console.error('Error obteniendo stocks de origen para anular:', errorStocksOrigen);
                        return { success: false, message: 'Error al obtener stocks de origen', error: errorStocksOrigen };
                    }

                    // Crear mapa de stocks para acceso rápido
                    const stocksOrigenMap = new Map();
                    stocksOrigen.forEach(stock => {
                        stocksOrigenMap.set(stock.producto_id, { id: stock.id, stock: stock.stock });
                    });

                    // Preparar actualizaciones de reversión
                    const actualizacionesReversion = [];

                    console.log(`📊 [ANULAR TRANSFERENCIA] Devolviendo stocks al origen para ${productosDetalle.length} productos`);

                    for (const producto of productosDetalle) {
                        const stockOrigen = stocksOrigenMap.get(producto.producto_almacen_id);
                        const stockOrigenValue = stockOrigen ? stockOrigen.stock : 0;
                        const stockOrigenId = stockOrigen ? stockOrigen.id : null;

                        // Calcular nuevo stock en origen (sumar de vuelta) - reversión
                        const nuevoStockOrigen = stockOrigenValue + producto.cantidad;
                        console.log(`📦 [ORIGEN REVERSIÓN] Producto ${producto.producto_almacen_id} | ${stockOrigenValue} + ${producto.cantidad} = ${nuevoStockOrigen}`);

                        if (stockOrigenId) {
                            actualizacionesReversion.push({
                                id: stockOrigenId,
                                stock: nuevoStockOrigen,
                                producto_id: producto.producto_almacen_id,
                                operacion: `${stockOrigenValue} + ${producto.cantidad} = ${nuevoStockOrigen}`
                            });
                        } else {
                            // Si no existe stock en origen, crear uno nuevo
                            const { error: insertError } = await supabase
                                .from('productos_sucursal')
                                .insert({
                                    producto_id: producto.producto_almacen_id,
                                    sucursal_id: transferenciaActual.sucu_origen_id,
                                    stock: producto.cantidad
                                });

                            if (insertError) {
                                console.error(`❌ [ORIGEN REVERSIÓN] Error creando stock para producto ${producto.producto_almacen_id}:`, insertError);
                                return {
                                    success: false,
                                    message: `Error al crear stock en origen: ${insertError.message}`,
                                    error: insertError
                                };
                            }
                            console.log(`🆕 [ORIGEN REVERSIÓN] Producto ${producto.producto_almacen_id} | Stock inicial: ${producto.cantidad}`);
                        }
                    }

                    // Ejecutar actualizaciones de reversión en origen
                    if (actualizacionesReversion.length > 0) {
                        console.log(`🔄 [ORIGEN REVERSIÓN] Procesando ${actualizacionesReversion.length} reversiones de stock`);
                        
                        try {
                            const rpcResult = await retryOperation(async () => {
                                const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                                    stock_updates: actualizacionesReversion.map(a => ({
                                        id: a.id,
                                        stock: a.stock
                                    }))
                                });

                                if (rpcError) {
                                    throw rpcError;
                                }

                                return { success: true };
                            });

                            console.log('✅ [ORIGEN REVERSIÓN] RPC completado exitosamente');

                        } catch (rpcError) {
                            console.warn('⚠️ [ORIGEN REVERSIÓN] RPC no disponible, usando método por lotes:', rpcError.message);

                            // Fallback: usar método por lotes con control de concurrencia
                            const updateOperations = actualizacionesReversion.map(actualizacion => 
                                retryOperation(async () => {
                                    console.log(`🔄 [REVIRTIENDO] Producto ${actualizacion.producto_id} | ${actualizacion.operacion}`);
                                    
                                    const { data, error } = await supabase
                                        .from('productos_sucursal')
                                        .update({ stock: actualizacion.stock })
                                        .eq('id', actualizacion.id)
                                        .select('id');
                                    
                                    if (error) {
                                        console.error(`❌ [ERROR REVERSIÓN] Producto ${actualizacion.producto_id} | ${actualizacion.operacion} | Error: ${error.message}`);
                                        throw error;
                                    }
                                    
                                    console.log(`✅ [REVERTIDO] Producto ${actualizacion.producto_id} | ${actualizacion.operacion}`);
                                    return { data, error: null };
                                })
                            );

                            // Procesar en lotes de máximo 50 operaciones
                            const { results, errors } = await processBatch(updateOperations, 50);
                            
                            // Validar que todas las operaciones fueron exitosas
                            try {
                                validateBatchResults(results);
                                console.log('✅ [ORIGEN REVERSIÓN] Reversión manual completada exitosamente');
                            } catch (validationError) {
                                console.error('❌ [ORIGEN REVERSIÓN] Error en reversión manual:', validationError.message);
                                // Revertir el estado de la transferencia
                                await supabase
                                    .from('transferencias_almacen')
                                    .update({ estado: 'Transferido' })
                                    .eq('id', transferenciaId);
                                return { 
                                    success: false, 
                                    message: 'Error al revertir stocks manualmente: ' + validationError.message, 
                                    error: validationError 
                                };
                            }
                            
                            // Si hay errores en el procesamiento por lotes, fallar completamente
                            if (errors.length > 0) {
                                console.error('❌ [ORIGEN REVERSIÓN] Errores en procesamiento por lotes:', errors);
                                // Revertir el estado de la transferencia
                                await supabase
                                    .from('transferencias_almacen')
                                    .update({ estado: 'Transferido' })
                                    .eq('id', transferenciaId);
                                return { 
                                    success: false, 
                                    message: 'Error al procesar reversión de stocks', 
                                    error: errors 
                                };
                            }
                        }
                    }

                    // Si la transferencia estaba en estado 'Finalizado' (auto-ingresada), también restar del destino
                    if (transferenciaActual.estado === 'Finalizado') {
                        console.log(`🔄 [DESTINO ANULACIÓN] Restando stock del destino para ${productosDetalle.length} productos`);
                        
                        // Obtener stocks actuales de la sucursal de destino
                        const { data: stocksDestinoAnulacion, error: errorStocksDestinoAnulacion } = await supabase
                            .from('productos_sucursal')
                            .select('id, producto_id, stock')
                            .eq('sucursal_id', transferenciaActual.sucu_destino_id)
                            .in('producto_id', productIds)
                            .limit(1000);

                        if (errorStocksDestinoAnulacion) {
                            console.error('Error obteniendo stocks de destino para anular:', errorStocksDestinoAnulacion);
                            return { success: false, message: 'Error al obtener stocks de destino para anular', error: errorStocksDestinoAnulacion };
                        }

                        const stocksDestinoAnulacionMap = new Map();
                        stocksDestinoAnulacion.forEach(stock => {
                            stocksDestinoAnulacionMap.set(stock.producto_id, { id: stock.id, stock: stock.stock });
                        });

                        const actualizacionesDestinoAnulacion = [];
                        for (const producto of productosDetalle) {
                            const stockDestino = stocksDestinoAnulacionMap.get(producto.producto_almacen_id);
                            const stockDestinoValue = stockDestino ? stockDestino.stock : 0;
                            const stockDestinoId = stockDestino ? stockDestino.id : null;

                            // Calcular nuevo stock en destino (restar) - reversión
                            const nuevoStockDestino = Math.max(0, stockDestinoValue - producto.cantidad);
                            console.log(`📦 [DESTINO ANULACIÓN] Producto ${producto.producto_almacen_id} | ${stockDestinoValue} - ${producto.cantidad} = ${nuevoStockDestino}`);

                            if (stockDestinoId) {
                                actualizacionesDestinoAnulacion.push({
                                    id: stockDestinoId,
                                    stock: nuevoStockDestino,
                                    producto_id: producto.producto_almacen_id
                                });
                            }
                        }

                        if (actualizacionesDestinoAnulacion.length > 0) {
                            try {
                                const rpcResultDestino = await retryOperation(async () => {
                                    const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                                        stock_updates: actualizacionesDestinoAnulacion.map(a => ({
                                            id: a.id,
                                            stock: a.stock
                                        }))
                                    });

                                    if (rpcError) {
                                        throw rpcError;
                                    }

                                    return { success: true };
                                });

                                console.log('✅ [DESTINO ANULACIÓN] RPC completado exitosamente');

                            } catch (rpcError) {
                                console.warn('⚠️ [DESTINO ANULACIÓN] RPC no disponible, usando método por lotes:', rpcError.message);

                                const updateOperationsDestino = actualizacionesDestinoAnulacion.map(actualizacion => 
                                    retryOperation(async () => {
                                        const { error: updateError } = await supabase
                                            .from('productos_sucursal')
                                            .update({ stock: actualizacion.stock })
                                            .eq('id', actualizacion.id);

                                        if (updateError) {
                                            throw updateError;
                                        }

                                        return { success: true };
                                    })
                                );

                                const { results: resultsDestino, errors: errorsDestino } = await processBatch(updateOperationsDestino, 50);

                                try {
                                    validateBatchResults(resultsDestino);
                                    console.log('✅ [DESTINO ANULACIÓN] Todas las actualizaciones completadas exitosamente');
                                } catch (validationError) {
                                    console.error('❌ [DESTINO ANULACIÓN] Error en validación de resultados:', validationError.message);
                                    return { 
                                        success: false, 
                                        message: 'Error al actualizar stocks de destino: ' + validationError.message, 
                                        error: validationError 
                                    };
                                }

                                if (errorsDestino.length > 0) {
                                    console.error('❌ [DESTINO ANULACIÓN] Errores en procesamiento por lotes:', errorsDestino);
                                    return { 
                                        success: false, 
                                        message: 'Error al procesar actualizaciones de stock en destino', 
                                        error: errorsDestino 
                                    };
                                }
                            }
                        }
                    }
                }
            }

            // Si el nuevo estado es 'Finalizado', sumar stock en destino (ya no se usa porque se auto-ingresa)
            if (nuevoEstado === 'Finalizado') {
                // Obtener los productos de la transferencia
                const { data: productosDetalle, error: detalleError } = await supabase
                    .from('transferencias_almacen_detalle')
                    .select('producto_almacen_id, cantidad')
                    .eq('transferencia_almacen_id', transferenciaId);

                if (detalleError) {
                    console.error('Error obteniendo detalles para finalizar transferencia:', detalleError);
                    return { success: false, message: 'Error al obtener detalles de productos para finalizar', error: detalleError };
                }

                if (productosDetalle && productosDetalle.length > 0) {
                    const productIds = productosDetalle.map(p => p.producto_almacen_id);

                    // Obtener stocks actuales de la sucursal de destino
                    const { data: stocksDestino, error: errorStocksDestino } = await supabase
                        .from('productos_sucursal')
                        .select('id, producto_id, stock')
                        .eq('sucursal_id', transferenciaActual.sucu_destino_id)
                        .in('producto_id', productIds)
                        .limit(1000);

                    if (errorStocksDestino) {
                        console.error('Error obteniendo stocks de destino para finalizar:', errorStocksDestino);
                        return { success: false, message: 'Error al obtener stocks de destino', error: errorStocksDestino };
                    }

                    // Crear mapa de stocks para acceso rápido
                    const stocksDestinoMap = new Map();
                    stocksDestino.forEach(stock => {
                        stocksDestinoMap.set(stock.producto_id, { id: stock.id, stock: stock.stock });
                    });

                    // Preparar actualizaciones y nuevas inserciones
                    const actualizacionesDestino = [];
                    const nuevasInsercionesDestino = [];

                    console.log(`📊 [FINALIZAR TRANSFERENCIA] Calculando stocks de destino para ${productosDetalle.length} productos`);

                    for (const producto of productosDetalle) {
                        const stockDestino = stocksDestinoMap.get(producto.producto_almacen_id);
                        const stockDestinoValue = stockDestino ? stockDestino.stock : 0;
                        const stockDestinoId = stockDestino ? stockDestino.id : null;

                        // Calcular nuevo stock en destino (sumar) - como una entrada
                        const nuevoStockDestino = stockDestinoValue + producto.cantidad;
                        console.log(`📦 [DESTINO] Producto ${producto.producto_almacen_id} | ${stockDestinoValue} + ${producto.cantidad} = ${nuevoStockDestino}`);

                        if (stockDestinoId) {
                            // Preparar actualización
                            actualizacionesDestino.push({
                                id: stockDestinoId,
                                stock: nuevoStockDestino,
                                producto_id: producto.producto_almacen_id
                            });
                        } else {
                            // Preparar nueva inserción
                            nuevasInsercionesDestino.push({
                                producto_id: producto.producto_almacen_id,
                                sucursal_id: transferenciaActual.sucu_destino_id,
                                stock: nuevoStockDestino
                            });
                            console.log(`🆕 [DESTINO] Producto ${producto.producto_almacen_id} | Stock inicial: ${nuevoStockDestino}`);
                        }
                    }

                    // Ejecutar actualizaciones de stock en destino
                    if (actualizacionesDestino.length > 0) {
                        console.log(`🔄 [DESTINO] Procesando ${actualizacionesDestino.length} actualizaciones de stock`);
                        
                        try {
                            const rpcResult = await retryOperation(async () => {
                                const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                                    stock_updates: actualizacionesDestino.map(a => ({
                                        id: a.id,
                                        stock: a.stock
                                    }))
                                });

                                if (rpcError) {
                                    throw rpcError;
                                }

                                return { success: true };
                            });

                            console.log('✅ [DESTINO] RPC completado exitosamente');

                        } catch (rpcError) {
                            console.warn('⚠️ [DESTINO] RPC no disponible, usando método por lotes:', rpcError.message);

                            // Fallback: usar método por lotes con control de concurrencia
                            const updateOperations = actualizacionesDestino.map(actualizacion => 
                                retryOperation(async () => {
                                    console.log(`🔄 [ACTUALIZANDO] Producto ${actualizacion.producto_id} | Stock: ${actualizacion.stock}`);
                                    
                                    const { data, error } = await supabase
                                        .from('productos_sucursal')
                                        .update({ stock: actualizacion.stock })
                                        .eq('id', actualizacion.id)
                                        .select('id');
                                    
                                    if (error) {
                                        console.error(`❌ [ERROR ACTUALIZACIÓN] Producto ${actualizacion.producto_id} | Error: ${error.message}`);
                                        throw error;
                                    }
                                    
                                    console.log(`✅ [ACTUALIZADO] Producto ${actualizacion.producto_id}`);
                                    return { data, error: null };
                                })
                            );
                            
                            // Procesar en lotes de máximo 50 operaciones
                            const { results, errors } = await processBatch(updateOperations, 50);
                            
                            // Validar que todas las operaciones fueron exitosas
                            try {
                                validateBatchResults(results);
                                console.log('✅ [DESTINO] Todas las actualizaciones completadas exitosamente');
                            } catch (validationError) {
                                console.error('❌ [DESTINO] Error en validación de resultados:', validationError.message);
                                // Revertir el estado de la transferencia
                                await supabase
                                    .from('transferencias_almacen')
                                    .update({ estado: 'Transferido' })
                                    .eq('id', transferenciaId);
                                return { 
                                    success: false, 
                                    message: 'Error al actualizar stocks: ' + validationError.message, 
                                    error: validationError 
                                };
                            }
                            
                            // Si hay errores en el procesamiento por lotes, fallar completamente
                            if (errors.length > 0) {
                                console.error('❌ [DESTINO] Errores en procesamiento por lotes:', errors);
                                // Revertir el estado de la transferencia
                                await supabase
                                    .from('transferencias_almacen')
                                    .update({ estado: 'Transferido' })
                                    .eq('id', transferenciaId);
                                return { 
                                    success: false, 
                                    message: 'Error al procesar actualizaciones de stock', 
                                    error: errors 
                                };
                            }
                        }
                    }

                    // Ejecutar inserciones de stock en destino
                    if (nuevasInsercionesDestino.length > 0) {
                        console.log(`🔄 [DESTINO] Procesando ${nuevasInsercionesDestino.length} inserciones de stock`);
                        
                        try {
                            const { data: insertData, error: insertError } = await supabase
                                .from('productos_sucursal')
                                .insert(nuevasInsercionesDestino)
                                .select('id');

                            if (insertError) {
                                console.error(`❌ [DESTINO] Error insertando stocks:`, insertError);
                                return {
                                    success: false,
                                    message: `Error al crear stocks en destino: ${insertError.message}`,
                                    error: insertError
                                };
                            }

                            console.log('✅ [DESTINO] Inserciones completadas exitosamente');

                        } catch (insertError) {
                            console.error('❌ [DESTINO] Error insertando stocks:', insertError);
                            return {
                                success: false,
                                message: 'Error al crear stocks en destino: ' + insertError.message,
                                error: insertError
                            };
                        }
                    }
                }
            }

            // Actualizar el estado de la transferencia
            const { data: transferencia, error } = await supabase
                .from('transferencias_almacen')
                .update({ estado: nuevoEstado })
                .eq('id', transferenciaId)
                .select(`
                    *,
                    sucursal_origen:sucu_origen_id(id, name),
                    sucursal_destino:sucu_destino_id(id, name),
                    precio:prices_types(id, name),
                    user:user_id(id, first_name, last_name),
                    personal:personal_id(id, first_name, last_name),
                    productos:transferencias_almacen_detalle(
                        id,
                        cantidad,
                        precio_unitario,
                        subtotal,
                        producto:producto_almacen_id(
                            id,
                            name,
                            description,
                            grup
                        )
                    )
                `)
                .single();

            if (error) {
                console.error('Error actualizando estado de transferencia:', error);
                return { success: false, message: 'Error al actualizar el estado de la transferencia', error };
            }

            return {
                success: true,
                data: transferencia
            };

        } catch (error) {
            console.error('Error en TransferenciasAlmacen.actualizarEstado:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Eliminar una transferencia
    static async eliminar(transferenciaId) {
        try {
            // Primero eliminar los detalles de la transferencia
            const { error: detallesError } = await supabase
                .from('transferencias_almacen_detalle')
                .delete()
                .eq('transferencia_almacen_id', transferenciaId);

            if (detallesError) {
                console.error('Error eliminando detalles de transferencia:', detallesError);
                return { success: false, message: 'Error al eliminar los detalles de la transferencia', error: detallesError };
            }

            // Luego eliminar la transferencia
            const { error: transferenciaError } = await supabase
                .from('transferencias_almacen')
                .delete()
                .eq('id', transferenciaId);

            if (transferenciaError) {
                console.error('Error eliminando transferencia:', transferenciaError);
                return { success: false, message: 'Error al eliminar la transferencia', error: transferenciaError };
            }

            return {
                success: true,
                data: { id: transferenciaId }
            };

        } catch (error) {
            console.error('Error en TransferenciasAlmacen.eliminar:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Método auxiliar para limpieza optimizada de transferencias
    static async cleanupTransferencia(transferenciaId) {
        try {
            // Eliminar productos primero (FK constraint)
            await supabase
                .from('transferencias_almacen_detalle')
                .delete()
                .eq('transferencia_almacen_id', transferenciaId);

            // Eliminar transferencia principal
            await supabase
                .from('transferencias_almacen')
                .delete()
                .eq('id', transferenciaId);

            console.log(`🧹 [CLEANUP] Transferencia ${transferenciaId} eliminada correctamente`);
        } catch (error) {
            console.error('Error en limpieza de transferencia:', error);
        }
    }
}

module.exports = transferenciasAlmacen;

