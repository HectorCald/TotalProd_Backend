const { supabase } = require('../config/supabase');

class movimientosAlmacen {
    // Crear un nuevo movimiento de almacén
    static async create(movimientoData) {
        
        try {
            const { user_id, personal_id, sucu_id, type, observaciones, metodo_pago, cliente_id, proveedor_id, precio_id, productos, restar_ingredientes, produccion_damabrava_id, agrupado, gasto_id } = movimientoData;

            // Crear timestamp en zona horaria de Bolivia (GMT-4) - OPTIMIZADO
            const ahora = new Date();
            const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));

            // Iniciar transacción - OPTIMIZADO: Solo campos necesarios, sin defaults
            const insertData = {
                sucu_id,
                type,
                observaciones: observaciones || null,
                metodo_pago: metodo_pago || null,
                cliente_id: cliente_id || null,
                proveedor_id: proveedor_id || null,
                restar_ingredientes: restar_ingredientes || false,
                produccion_damabrava_id: produccion_damabrava_id || null,
                agrupado: !!agrupado,
                fecha: ahoraBolivia.toISOString(), // Usar timestamp en zona horaria de Bolivia
                estado: 'finalizado' // Estado por defecto
            };

            // Solo agregar campos que tienen valor - OPTIMIZADO
            if (precio_id !== null && precio_id !== undefined) {
                insertData.precio_id = precio_id;
            }
            if (user_id && user_id !== null) {
                insertData.user_id = user_id;
            }
            if (personal_id && personal_id !== null) {
                insertData.personal_id = personal_id;
            }
            if (gasto_id && gasto_id !== null) {
                insertData.gasto_id = gasto_id;
            }

            
            // Insertar movimiento con timeout y retry
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .insert(insertData)
                .select('id, sucu_id, type, fecha, estado, user_id, personal_id, precio_id, observaciones, metodo_pago, cliente_id, proveedor_id, restar_ingredientes, produccion_damabrava_id, agrupado')
                .single();
                

            if (movimientoError) {
                console.error('Error creando movimiento:', movimientoError);
                return { success: false, message: 'Error al crear el movimiento', error: movimientoError };
            }

            // Crear los detalles de productos si existen - ULTRA OPTIMIZADO
            if (productos && productos.length > 0) {
                
                // Preparar datos de productos de forma ultra eficiente
                const productosData = productos.map(producto => {
                    const precio = Number(producto.precio) || 0;
                    const cantidad = Number(producto.cantidad);
                    return {
                    movimiento_almacen_id: movimiento.id,
                    producto_almacen_id: producto.id,
                        cantidad: cantidad,
                        precio_unitario: precio,
                        subtotal: precio * cantidad
                    };
                });

                // Insertar todos los productos en una sola operación con timeout
                const { error: productosError } = await supabase
                    .from('movimiento_almacen_producto')
                    .insert(productosData)
                    .select('id'); // Solo retornar IDs para verificar inserción
                    

                if (productosError) {
                    console.error('Error creando detalles de productos:', productosError);
                            // Limpieza optimizada
                            await this.cleanupMovimiento(movimiento.id);
                    return { success: false, message: 'Error al crear los detalles de productos', error: productosError };
                }

                // Actualizar stock de productos después de crear el movimiento - OPTIMIZADO EN LOTE
                
                // 1. Obtener todos los stocks actuales en una sola consulta (ULTRA OPTIMIZADA)
                const productIds = productos.map(p => p.id);
                
                // Consulta ultra optimizada: usar raw SQL para mejor performance
                const { data: stocksActuales, error: errorStocks } = await supabase
                        .from('productos_sucursal')
                    .select('id, producto_id, stock')
                        .eq('sucursal_id', sucu_id)
                    .in('producto_id', productIds)
                    .limit(1000); // Limitar resultados para evitar escaneos grandes

                if (errorStocks) {
                    console.error('Error obteniendo stocks:', errorStocks);
                    // Limpieza optimizada: eliminar en orden correcto
                    await this.cleanupMovimiento(movimiento.id);
                    return { success: false, message: 'Error al obtener stocks', error: errorStocks };
                }

                // 2. Crear mapa de stocks para acceso rápido
                const stocksMap = new Map();
                stocksActuales.forEach(stock => {
                    stocksMap.set(stock.producto_id, { id: stock.id, stock: stock.stock });
                });

                // 3. Preparar actualizaciones y nuevas inserciones
                const actualizaciones = [];
                const nuevasInserciones = [];
                const productosConStockCalculado = [];

                for (const producto of productos) {
                    const stockActual = stocksMap.get(producto.id);
                    const stockActualValue = stockActual ? stockActual.stock : 0;
                    const stockId = stockActual ? stockActual.id : null;

                    let nuevaCantidad;
                    if (type === 'entrada') {
                        nuevaCantidad = stockActualValue + producto.cantidad;
                    } else if (type === 'salida') {
                        nuevaCantidad = stockActualValue - producto.cantidad;
                        
                        // Verificar que hay suficiente stock
                        if (nuevaCantidad < 0) {
                            console.error(`Stock insuficiente para producto ${producto.id}. Stock actual: ${stockActualValue}, Cantidad requerida: ${producto.cantidad}`);
                            // Si falla, eliminar el movimiento y sus productos
                            await supabase
                                .from('movimiento_almacen_producto')
                                .delete()
                                .eq('movimiento_almacen_id', movimiento.id);
                            
                            await supabase
                                .from('movimientos_almacen')
                                .delete()
                                .eq('id', movimiento.id);
                            
                            return { success: false, message: 'Stock insuficiente', error: 'Stock insuficiente' };
                        }
                    }

                    // Guardar stock calculado para respuesta
                    productosConStockCalculado.push({
                        id: producto.id,
                        cantidad: producto.cantidad,
                        precio: producto.precio,
                        stock: nuevaCantidad
                    });

                    if (stockId) {
                        // Preparar actualización
                        actualizaciones.push({
                            id: stockId,
                            stock: nuevaCantidad
                        });
                    } else {
                        // Preparar nueva inserción
                        nuevasInserciones.push({
                                producto_id: producto.id,
                                sucursal_id: sucu_id,
                                stock: nuevaCantidad
                        });
                    }
                }

                // 4. Ejecutar actualizaciones en lote (ULTRA OPTIMIZADO)
                if (actualizaciones.length > 0) {
                    
                    try {
                        // Intentar usar función RPC primero (más eficiente)
                        const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                            stock_updates: actualizaciones.map(a => ({
                                id: a.id,
                                stock: a.stock
                            }))
                        });
                        

                        if (rpcError) {
                            throw rpcError;
                        }
                    } catch (rpcError) {
                        console.warn('RPC no disponible, usando método paralelo:', rpcError.message);
                        
                        // Fallback: usar método paralelo
                        const updatePromises = actualizaciones.map(actualizacion =>
                            supabase
                            .from('productos_sucursal')
                                .update({ stock: actualizacion.stock })
                                .eq('id', actualizacion.id)
                                .select('id') // Solo retornar ID para verificar
                        );
                        
                        const updateResults = await Promise.allSettled(updatePromises);

                        // Verificar errores en actualizaciones
                        const errores = updateResults
                            .filter(result => result.status === 'rejected' || result.value?.error)
                            .map(result => result.status === 'rejected' ? result.reason : result.value?.error);
                            
                        if (errores.length > 0) {
                            console.error('Errores en actualizaciones de stock:', errores);
                            // Limpieza optimizada
                            await this.cleanupMovimiento(movimiento.id);
                            return { success: false, message: 'Error al actualizar stocks', error: errores };
                        }
                    }
                }

                // 5. Ejecutar inserciones en lote
                if (nuevasInserciones.length > 0) {
                    const { error: insertError } = await supabase
                        .from('productos_sucursal')
                        .insert(nuevasInserciones);

                        if (insertError) {
                            console.error('Error insertando stocks:', insertError);
                            // Limpieza optimizada
                            await this.cleanupMovimiento(movimiento.id);
                            return { success: false, message: 'Error al crear stocks', error: insertError };
                        }
                }
                
            }

            // Usar datos del movimiento ya creado y stock calculado (SIN CONSULTAS ADICIONALES)
            const tPrepareResponseStart = Date.now();
            
            // Preparar respuesta con datos ya disponibles
            const movimientoBasico = {
                id: movimiento.id,
                type: movimiento.type,
                observaciones: movimiento.observaciones,
                fecha: movimiento.fecha,
                metodo_pago: movimiento.metodo_pago,
                precio_id: movimiento.precio_id,
                cliente_id: movimiento.cliente_id,
                proveedor_id: movimiento.proveedor_id,
                restar_ingredientes: movimiento.restar_ingredientes,
                produccion_damabrava_id: movimiento.produccion_damabrava_id,
                agrupado: movimiento.agrupado
            };

            // Usar productos con stock calculado (ya calculado arriba) o preparar fallback
            let productosConStock;
            if (productos && productos.length > 0) {
                // Si se procesaron productos, usar el stock calculado
                if (typeof productosConStockCalculado !== 'undefined' && productosConStockCalculado) {
                    productosConStock = productosConStockCalculado;
                } else {
                    // Fallback: crear array con stock 0
                    productosConStock = productos.map(producto => ({
                        id: producto.id,
                        cantidad: producto.cantidad,
                        precio: producto.precio,
                        stock: 0
                    }));
                }
            } else {
                // Si no hay productos, array vacío
                productosConStock = [];
            }
            

            // Para salidas con cliente: incrementar total_orders PRIMERO, luego guardar el valor actualizado en numero_orden
            if (type === 'salida' && cliente_id) {
                try {
                    // 1) PRIMERO: Incrementar total_orders del cliente
                    const incrementResult = await this.incrementarTotalOrdersCliente(cliente_id);
                    if (!incrementResult.success) {
                        console.warn('Error incrementando total_orders del cliente:', incrementResult.message);
                    } else {
                        // 2) SEGUNDO: Obtener el total_orders actualizado del cliente
                        const { data: clienteActualizado, error: clienteError } = await supabase
                            .from('clients')
                            .select('total_orders')
                            .eq('id', cliente_id)
                            .single();

                        if (clienteError) {
                            console.warn('Error obteniendo total_orders actualizado del cliente:', clienteError);
                        } else {
                            const numeroOrdenActualizado = clienteActualizado?.total_orders || 0;
                            
                            // 3) TERCERO: Actualizar el movimiento con el numero_orden (total_orders actualizado del cliente)
                            const { error: updateMovimientoError } = await supabase
                                .from('movimientos_almacen')
                                .update({ numero_orden: numeroOrdenActualizado })
                                .eq('id', movimiento.id);

                            if (updateMovimientoError) {
                                console.warn('Error actualizando numero_orden del movimiento:', updateMovimientoError);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error procesando numero_orden:', error);
                }
            }

            return { 
                success: true, 
                data: {
                    ...movimientoBasico,
                    productos: productosConStock
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.create:', error);
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
                    proveedor:proveedores(id, name, total_orders),
                    precio:prices_types(id, name),
                    sucursal:sucu_id(id, name)
                `)
                .eq('id', id)
                .single();

            if (movimientoError) {
                return { success: false, message: 'Movimiento no encontrado', error: movimientoError };
            }

            // Obtener productos del movimiento
            const { data: productos, error: productosError } = await supabase
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
                .eq('movimiento_almacen_id', id);

            if (productosError) {
                console.error('Error obteniendo productos del movimiento:', productosError);
            }

            // Obtener el stock actualizado de cada producto en la sucursal del movimiento
            const productosConStock = await Promise.all(
                (productos || []).map(async (productoMovimiento) => {
                    const { data: stockActual } = await supabase
                        .from('productos_sucursal')
                        .select('stock')
                        .eq('producto_id', productoMovimiento.producto.id)
                        .eq('sucursal_id', movimiento.sucu_id)
                        .single();
                    
                    return {
                        ...productoMovimiento,
                        producto: {
                            ...productoMovimiento.producto,
                            stock: stockActual ? stockActual.stock : 0
                        }
                    };
                })
            );

            // Obtener información del usuario o personal
            let user = null;
            let personal = null;

            // Si tiene user_id, obtener el usuario
            if (movimiento.user_id) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', movimiento.user_id)
                    .single();
                
                if (!userError && userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            // Si tiene personal_id, obtener el personal
            if (movimiento.personal_id) {
                const { data: personalData, error: personalError } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', movimiento.personal_id)
                    .single();
                
                if (!personalError && personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            // Verificar si el movimiento está relacionado con algún pedido (como salida o entrada)
            const { data: pedidosRelacionados } = await supabase
                .from('pedidos_almacen')
                .select('id')
                .or(`movimiento_salida_id.eq.${id},movimiento_entrada_id.eq.${id}`)
                .limit(1);

            const tienePedidoRelacionado = !!(pedidosRelacionados && pedidosRelacionados.length > 0);

            return {
                success: true,
                data: {
                    ...movimiento,
                    productos: productosConStock,
                    user,
                    personal,
                    tiene_pedido_relacionado: tienePedidoRelacionado
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getById:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener todos los movimientos de una sucursal
    static async getAll(sucuId, page = 1, limit = 10, tipo = null, estado = null, ordenamiento = 'fecha_desc', search = null) {
        try {
            const tStart = Date.now();
            const offset = (page - 1) * limit;

            let query = supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name, total_orders),
                    proveedor:proveedores(id, name, total_orders),
                    precio:prices_types(id, name),
                    sucursal:sucu_id(id, name),
                    user:user_id(id, first_name, last_name),
                    personal:personal_id(id, first_name, last_name)
                `, { count: 'exact' })
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

            // Obtener productos y información de usuario para cada movimiento
			// Hidratación OPTIMIZADA: cargar en lote para evitar N+1
            const movimientoIds = movimientos.map(m => m.id);

			const tHydrateStart = Date.now();

			// 1) Productos de todos los movimientos en una sola consulta
			let tProductosBatchMs = 0;
			const tProdBatchStart = Date.now();
			const { data: productosAll } = await supabase
				.from('movimiento_almacen_producto')
				.select(`
					movimiento_almacen_id,
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
				.in('movimiento_almacen_id', movimientoIds);
			tProductosBatchMs = Date.now() - tProdBatchStart;
			const productosByMovimiento = new Map();
            (movimientoIds || []).forEach(id => productosByMovimiento.set(id, []));
            (productosAll || []).forEach(p => {
				const arr = productosByMovimiento.get(p.movimiento_almacen_id) || [];
				arr.push(p);
				productosByMovimiento.set(p.movimiento_almacen_id, arr);
			});

            // Usuarios y personal vienen embebidos en la query principal (sin llamadas extra)

			// Armar respuesta final (sin relación con pedidos para acelerar listado)
            let movimientosConProductos = movimientos.map(mov => {
                const user = mov.user ? { id: mov.user.id, name: `${mov.user.first_name || ''} ${mov.user.last_name || ''}`.trim() } : null;
                const personal = mov.personal ? { id: mov.personal.id, name: `${mov.personal.first_name || ''} ${mov.personal.last_name || ''}`.trim() } : null;
				return {
					...mov,
					productos: productosByMovimiento.get(mov.id) || [],
                    user,
                    personal
				};
			});

            // Ya prefiltramos por IDs si search existe; no es necesario refiltrar en memoria

            const tHydrateMs = Date.now() - tHydrateStart;

            const tTotalMs = Date.now() - tStart;
            const result = {
                success: true,
                data: movimientosConProductos,
                pagination: {
                    total: search ? movimientosConProductos.length : count,
                    page,
                    limit,
                    hasNextPage: search ? false : count > offset + limit
                }
            };
            return result;

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getAll:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener movimientos por tipo (entrada/salida)
    static async getByType(sucuId, type, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;

            const { data: movimientos, error, count } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:proveedores(id, name),
                    precio:prices_types(id, name)
                `, { count: 'exact' })
                .eq('sucu_id', sucuId)
                .eq('type', tipo)
                .order('fecha', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                return { success: false, message: 'Error al obtener movimientos', error };
            }

            // Obtener productos para cada movimiento
            const movimientosConProductos = await Promise.all(
                movimientos.map(async (movimiento) => {
                    const { data: productos } = await supabase
                        .from('movimiento_almacen_producto')
                        .select(`
                            *,
                            producto:producto_almacen_id(
                                id, 
                                name, 
                                description
                            )
                        `)
                        .eq('movimiento_almacen_id', movimiento.id);

                    return {
                        ...movimiento,
                        productos: productos || []
                    };
                })
            );

            return {
                success: true,
                data: movimientosConProductos,
                pagination: {
                    total: count,
                    page,
                    limit,
                    hasNextPage: count > offset + limit
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getByType:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }


    // Método para restar ingredientes del stock cuando se hace una entrada con receta
    static async restarIngredientes(productoPrincipal, cantidadEntrada, ingredientes, empresaId) {
        try {
            // Preparar datos de ingredientes válidos
            const ingredientesValidos = ingredientes.filter(ingrediente => 
                ingrediente.products_acopio && ingrediente.products_acopio.id
            );

            if (ingredientesValidos.length === 0) {
                return { success: true, message: 'No hay ingredientes válidos para procesar' };
            }

            // Obtener IDs de ingredientes para consulta bulk
            const ingredienteIds = ingredientesValidos.map(ingrediente => ingrediente.products_acopio.id);

            // Consulta bulk para obtener stocks actuales
            const { data: productosActuales, error: fetchError } = await supabase
                .from('products_acopio')
                .select('id, quantity')
                .in('id', ingredienteIds);

            if (fetchError) {
                console.error('Error obteniendo stocks de ingredientes:', fetchError);
                throw new Error('Error al obtener stocks de ingredientes');
            }

            // Crear mapa de stocks actuales para acceso rápido
            const stocksActuales = {};
            productosActuales.forEach(producto => {
                stocksActuales[producto.id] = producto.quantity;
            });

            // Preparar actualizaciones batch
            const actualizaciones = [];
            const ingredientesConStockInsuficiente = [];

            for (const ingrediente of ingredientesValidos) {
                const cantidadARestar = ingrediente.cantidad * cantidadEntrada;
                const cantidadActual = stocksActuales[ingrediente.products_acopio.id] || 0;
                const nuevaCantidad = cantidadActual - cantidadARestar;
                
                // Verificar stock suficiente
                if (nuevaCantidad < 0) {
                    ingredientesConStockInsuficiente.push({
                        nombre: ingrediente.products_acopio.name,
                        stockActual: cantidadActual,
                        requerido: cantidadARestar
                    });
                    continue;
                }

                actualizaciones.push({
                    id: ingrediente.products_acopio.id,
                    quantity: nuevaCantidad
                });
            }

            // Si hay ingredientes con stock insuficiente, retornar error
            if (ingredientesConStockInsuficiente.length > 0) {
                console.warn('Ingredientes con stock insuficiente:', ingredientesConStockInsuficiente);
                
                // Crear mensaje detallado de error
                const mensajeError = ingredientesConStockInsuficiente.map(ing => 
                    `${ing.nombre}: Stock actual ${ing.stockActual}, requerido ${ing.requerido}`
                ).join('; ');
                
                return { 
                    success: false, 
                    message: `Stock insuficiente de ingredientes: ${mensajeError}`,
                    ingredientesConStockInsuficiente: ingredientesConStockInsuficiente
                };
            }

            // Ejecutar actualizaciones batch si hay ingredientes válidos
            if (actualizaciones.length > 0) {
                // Usar Promise.all para actualizaciones paralelas (más rápido que secuencial)
                const updatePromises = actualizaciones.map(actualizacion =>
                    supabase
                        .from('products_acopio')
                        .update({ quantity: actualizacion.quantity })
                        .eq('id', actualizacion.id)
                );

                const updateResults = await Promise.all(updatePromises);

                // Verificar errores en las actualizaciones
                const errores = updateResults
                    .map((result, index) => ({ result, index }))
                    .filter(({ result }) => result.error);

                if (errores.length > 0) {
                    console.error('Errores en actualizaciones de ingredientes:', errores);
                    
                    // Intentar rollback de las actualizaciones exitosas
                    const exitosas = updateResults
                        .map((result, index) => ({ result, index }))
                        .filter(({ result }) => !result.error);

                    if (exitosas.length > 0) {
                        console.log('Intentando rollback de actualizaciones exitosas...');
                        const rollbackPromises = exitosas.map(({ index }) =>
                            supabase
                                .from('products_acopio')
                                .update({ quantity: stocksActuales[actualizaciones[index].id] })
                                .eq('id', actualizaciones[index].id)
                        );

                        await Promise.all(rollbackPromises);
                        console.log('Rollback completado');
                    }

                    throw new Error('Error al actualizar algunos ingredientes');
                }
            }

            return { 
                success: true, 
                message: 'Ingredientes restados correctamente',
                actualizados: actualizaciones.length,
                conStockInsuficiente: ingredientesConStockInsuficiente.length
            };
        } catch (error) {
            console.error('Error en restarIngredientes:', error);
            throw new Error('Error al restar ingredientes del stock');
        }
    }

    // Método batch para restar ingredientes de múltiples productos
    static async restarIngredientesBatch(ingredientesParaRestar, empresaId) {
        try {
            // Recopilar todos los ingredientes únicos de todos los productos
            const todosLosIngredientes = [];
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
            return await this.restarIngredientes(
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

    // Anular un movimiento
    static async anular(movimientoId, desdePedido = false) {
        
        try {
            // Obtener el movimiento con datos mínimos (ULTRA OPTIMIZADO)
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .select('id, sucu_id, type, estado, restar_ingredientes, produccion_damabrava_id, cliente_id')
                .eq('id', movimientoId)
                .maybeSingle(); // Usar maybeSingle para mejor performance

            if (movimientoError) {
                console.error('Error obteniendo movimiento:', movimientoError);
                return { success: false, message: 'Movimiento no encontrado' };
            }

            if (!movimiento) {
                return { success: false, message: 'Movimiento no encontrado' };
            }

            // Verificar que no esté ya anulado
            if (movimiento.estado === 'anulado') {
                return { success: false, message: 'El movimiento ya está anulado' };
            }

            // Obtener productos del movimiento (SEPARADO - OPTIMIZADO)
            const { data: productos, error: productosError } = await supabase
                .from('movimiento_almacen_producto')
                .select('id, cantidad, producto_almacen_id')
                .eq('movimiento_almacen_id', movimientoId)
                .limit(100); // Limitar resultados para evitar escaneos grandes

            if (productosError) {
                console.error('Error obteniendo productos:', productosError);
                return { success: false, message: 'Error al obtener productos del movimiento' };
            }

            // Agregar productos al movimiento
            movimiento.productos = productos || [];

            // Si el movimiento tiene produccion_damabrava_id, manejar la anulación especial
            if (movimiento.produccion_damabrava_id) {
                
                // Obtener el registro de producción de Damabrava
                const { data: registroProduccion, error: registroError } = await supabase
                    .from('registros_produccion_damabrava')
                    .select('id, estado, cantidad_ingresada, cantidad_verificada')
                    .eq('id', movimiento.produccion_damabrava_id)
                    .single();

                if (registroError) {
                    console.error('Error obteniendo registro de producción:', registroError);
                    return { success: false, message: 'Error al obtener el registro de producción relacionado' };
                }

                if (registroProduccion) {
                    // Calcular la cantidad total del movimiento (suma de todos los productos)
                    const cantidadTotalMovimiento = movimiento.productos.reduce((total, producto) => {
                        return total + parseFloat(producto.cantidad);
                    }, 0);

                    // Calcular la nueva cantidad ingresada
                    const nuevaCantidadIngresada = Math.max(0, (registroProduccion.cantidad_ingresada || 0) - cantidadTotalMovimiento);
                    
                    // Determinar el nuevo estado del registro
                    let nuevoEstado = registroProduccion.estado;
                    if (registroProduccion.estado === 'Ingresado' && nuevaCantidadIngresada < registroProduccion.cantidad_verificada) {
                        nuevoEstado = 'verificado';
                    }

                    // Actualizar el registro de producción
                    const { error: updateRegistroError } = await supabase
                        .from('registros_produccion_damabrava')
                        .update({
                            cantidad_ingresada: nuevaCantidadIngresada,
                            estado: nuevoEstado
                        })
                        .eq('id', movimiento.produccion_damabrava_id);

                    if (updateRegistroError) {
                        console.error('Error actualizando registro de producción:', updateRegistroError);
                        return { success: false, message: 'Error al actualizar el registro de producción' };
                    }

                    console.log(`Registro de producción ${movimiento.produccion_damabrava_id} actualizado: cantidad_ingresada=${nuevaCantidadIngresada}, estado=${nuevoEstado}`);
                }
                
            }

            // Si tiene gasto_id: PRIMERO limpiar gasto_id en el movimiento, LUEGO eliminar el gasto
            const { data: gastoAsociado } = await supabase
                .from('movimientos_almacen')
                .select('gasto_id')
                .eq('id', movimientoId)
                .maybeSingle();

            const gastoIdAEliminar = gastoAsociado?.gasto_id || null;

            if (gastoIdAEliminar) {
                // 1) Limpiar gasto_id del movimiento para evitar FK al borrar el gasto
                const { error: limpiarGastoIdError } = await supabase
                    .from('movimientos_almacen')
                    .update({ gasto_id: null })
                    .eq('id', movimientoId);

                if (limpiarGastoIdError) {
                    console.error('Error limpiando gasto_id del movimiento:', limpiarGastoIdError);
                    return { success: false, message: 'Error al limpiar gasto del movimiento' };
                }

                // 2) Eliminar el gasto ahora que no hay referencia
                const { error: deleteGastoError } = await supabase
                    .from('gastos')
                    .delete()
                    .eq('id', gastoIdAEliminar);

                if (deleteGastoError) {
                    console.error('Error eliminando gasto asociado:', deleteGastoError);
                    return { success: false, message: 'Error al eliminar el gasto asociado' };
                }
            }

            // Validar que no esté relacionado con pedidos (ULTRA OPTIMIZADO)
            const { data: pedidosRelacionados, error: pedidosError } = await supabase
                .from('pedidos_almacen')
                .select('id')
                .or(`movimiento_salida_id.eq.${movimientoId},movimiento_entrada_id.eq.${movimientoId}`)
                .limit(1)
                .maybeSingle(); // Usar maybeSingle para mejor performance

            if (pedidosError) {
                console.error('Error validando pedidos relacionados:', pedidosError);
                return { success: false, message: 'Error al validar pedidos relacionados' };
            }

            if (pedidosRelacionados && !desdePedido) {
                return { success: false, message: 'No se puede anular: el movimiento está relacionado con un pedido' };
            }

            // Preparar actualizaciones de stock antes de cambiar estado (OPTIMIZADO)
            const productIds = movimiento.productos.map(p => p.producto_almacen_id);
            const { data: stocksActuales, error: errorStocks } = await supabase
                    .from('productos_sucursal')
                .select('id, producto_id, stock')
                    .eq('sucursal_id', movimiento.sucu_id)
                .in('producto_id', productIds)
                .limit(100); // Limitar resultados para evitar escaneos grandes

            if (errorStocks) {
                console.error('Error obteniendo stocks para preparación:', errorStocks);
                return { success: false, message: 'Error al obtener stocks para reversión' };
            }

            // Crear mapa de stocks
            const stocksMap = new Map();
            stocksActuales.forEach(stock => {
                stocksMap.set(stock.producto_id, { id: stock.id, stock: stock.stock });
            });

            // Preparar actualizaciones de reversión
            const actualizacionesReversion = [];
            for (const productoMovimiento of movimiento.productos) {
                const cantidadMovimiento = parseFloat(productoMovimiento.cantidad);
                const stockActual = stocksMap.get(productoMovimiento.producto_almacen_id);
                const stockActualValue = stockActual ? stockActual.stock : 0;
                const stockId = stockActual ? stockActual.id : null;

                let nuevaCantidad;
                if (movimiento.type === 'entrada') {
                    nuevaCantidad = stockActualValue - cantidadMovimiento;
                } else {
                    nuevaCantidad = stockActualValue + cantidadMovimiento;
                }

                if (stockId) {
                    actualizacionesReversion.push({
                        id: stockId,
                        stock: nuevaCantidad
                    });
                }
            }

            // Usar función RPC específica para anular (ATÓMICA) - UNA SOLA OPERACIÓN
            let rpcSuccess = false;
            
            try {
                const { error: rpcError } = await supabase.rpc('anular_movimiento_batch', {
                    movimiento_id: movimientoId,
                    stock_updates: actualizacionesReversion
                });

                if (rpcError) {
                    throw rpcError;
                }
                
                rpcSuccess = true;
                console.log(`✅ [MODEL ANULAR] RPC completado exitosamente - NO se necesita reversión manual`);
                
            } catch (rpcError) {
                console.warn('RPC anular_movimiento_batch no disponible, usando método tradicional:', rpcError.message);
                
                // Fallback: método tradicional (solo actualizar estado)
                const { error: updateError } = await supabase
                            .from('movimientos_almacen')
                    .update({ estado: 'anulado' })
                    .eq('id', movimientoId)
                    .select('id')
                    .single();

                if (updateError) {
                    console.error('Error actualizando estado:', updateError);
                    return { success: false, message: 'Error al anular el movimiento' };
                }
                
                rpcSuccess = false;
            }

            // Solo hacer reversión manual si el RPC falló
            if (!rpcSuccess && actualizacionesReversion.length > 0) {
                
                try {
                    // Usar función RPC para actualizaciones en lote
                    const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                        stock_updates: actualizacionesReversion
                    });

                    if (rpcError) {
                        throw rpcError;
                    }


                } catch (rpcError) {
                    console.warn('RPC no disponible para reversión manual, usando método paralelo:', rpcError.message);
                    
                    // Fallback: usar método paralelo
                    const updatePromises = actualizacionesReversion.map(actualizacion =>
                        supabase
                            .from('productos_sucursal')
                            .update({ stock: actualizacion.stock })
                            .eq('id', actualizacion.id)
                    );

                    const updateResults = await Promise.allSettled(updatePromises);

                    // Verificar errores
                    const errores = updateResults
                        .filter(result => result.status === 'rejected' || result.value?.error)
                        .map(result => result.status === 'rejected' ? result.reason : result.value?.error);
                        
                    if (errores.length > 0) {
                        console.error('Errores en reversión manual de stocks:', errores);
                        // Revertir el estado del movimiento
                        await supabase
                            .from('movimientos_almacen')
                            .update({ estado: 'finalizado' })
                            .eq('id', movimientoId);
                        return { success: false, message: 'Error al revertir stocks manualmente', error: errores };
                    }
                }
            } else if (rpcSuccess) {
                console.log(`✅ [MODEL ANULAR] RPC exitoso - Saltando reversión manual redundante`);
            }

            // Si es entrada, tiene receta Y restar_ingredientes es true, devolver ingredientes consumidos
            if (movimiento.type === 'entrada' && movimiento.restar_ingredientes) {
                console.log('🔄 [MODEL ANULAR] Devolviendo ingredientes para movimiento de entrada con restar_ingredientes=true');
                
                // Obtener recetas de cada producto del movimiento
                for (const productoMovimiento of movimiento.productos) {
                    const cantidadMovimiento = parseFloat(productoMovimiento.cantidad);
                    
                    // Obtener recetas del producto de almacén
                    const { data: recetas, error: recetasError } = await supabase
                        .from('recetas')
                        .select(`
                            id,
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
                        .eq('producto_almacen_id', productoMovimiento.producto_almacen_id)
                        .limit(1);
                    
                    if (!recetasError && recetas && recetas.length > 0) {
                        const receta = recetas[0];
                        
                        if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                            // Devolver ingredientes (sumar al stock)
                            for (const ingrediente of receta.recetas_detalle) {
                                if (!ingrediente.products_acopio || !ingrediente.products_acopio.id) {
                                    continue;
                                }

                                const cantidadADevolver = ingrediente.cantidad * cantidadMovimiento;
                                const cantidadActual = ingrediente.products_acopio.quantity;
                                const nuevaCantidadIngrediente = cantidadActual + cantidadADevolver;

                                const { error: ingredienteError } = await supabase
                                    .from('products_acopio')
                                    .update({ quantity: nuevaCantidadIngrediente })
                                    .eq('id', ingrediente.products_acopio.id);

                                if (ingredienteError) {
                                    console.error(`Error devolviendo ingrediente ${ingrediente.products_acopio.name}:`, ingredienteError);
                                    // Continuar con el siguiente ingrediente
                                } else {
                                    console.log(`✅ [MODEL ANULAR] Ingrediente devuelto: ${ingrediente.products_acopio.name} - Cantidad: ${cantidadADevolver}`);
                                }
                            }
                        }
                    }
                }
            }

            // Decrementar total_orders del cliente si es una salida con cliente
            if (movimiento.type === 'salida' && movimiento.cliente_id) {
                const decrementResult = await this.decrementarTotalOrdersCliente(movimiento.cliente_id);
                if (!decrementResult.success) {
                    console.warn('Error decrementando total_orders del cliente:', decrementResult.message);
                    // No fallar la anulación por esto, solo logear el warning
                }
            }

            return { 
                success: true, 
                message: 'Movimiento anulado correctamente',
                data: { ...movimiento, estado: 'anulado' }
            };

        } catch (error) {
            console.error('Error en anular movimiento:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    // Eliminar un movimiento
    static async eliminar(movimientoId) {
        try {
            // Verificar que el movimiento existe
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .select('id, estado')
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

    // Verificar si un producto tiene movimientos (ULTRA OPTIMIZADO - SOLO EXISTENCIA)
    static async hasMovements(productId, sucuId) {
        try {
            if (!productId) {
                throw new Error('ID del producto es requerido');
            }

            if (!sucuId) {
                throw new Error('ID de la sucursal es requerido');
            }

            // OPTIMIZACIÓN MÁXIMA: Solo verificar existencia con JOIN mínimo
            const { data, error } = await supabase
                .from('movimiento_almacen_producto')
                .select(`
                    id,
                    movimientos_almacen!inner(sucu_id)
                `)
                .eq('producto_almacen_id', productId)
                .eq('movimientos_almacen.sucu_id', sucuId)
                .limit(1)
                .single();

            if (error) {
                // Si no encuentra registros, significa que no tiene movimientos
                if (error.code === 'PGRST116') {
                    return { success: true, hasMovements: false };
                }
                console.error('Error verificando movimientos:', error);
                return { success: false, message: 'Error al verificar movimientos', error };
            }

            // Si encuentra al menos un registro, tiene movimientos
            return { success: true, hasMovements: true };

        } catch (error) {
            console.error('Error en hasMovements:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener movimientos por producto (ULTRA OPTIMIZADO)
    static async getByProduct(productId, sucuId, limit = 10) {
        try {
            if (!productId) {
                throw new Error('ID del producto es requerido');
            }

            if (!sucuId) {
                throw new Error('ID de la sucursal es requerido');
            }

            // OPTIMIZACIÓN: Obtener directamente los movimientos que contienen el producto
            // usando JOIN en lugar de N+1 queries
            const { data: movimientosConProducto, error } = await supabase
                .from('movimiento_almacen_producto')
                .select(`
                    movimiento_almacen_id,
                    cantidad,
                    precio_unitario,
                    subtotal,
                    movimientos_almacen!inner(
                        id,
                        type,
                        fecha,
                        observaciones,
                        metodo_pago,
                        estado,
                        cliente:clients(id, name),
                        proveedor:proveedores(id, name),
                        precio:prices_types(id, name)
                    )
                `)
                .eq('producto_almacen_id', productId)
                .eq('movimientos_almacen.sucu_id', sucuId)
                .limit(limit);

            if (error) {
                console.error('Error obteniendo movimientos por producto:', error);
                return { success: false, message: 'Error al obtener movimientos', error };
            }

            // Transformar la respuesta para mantener la estructura esperada
            const movimientosTransformados = movimientosConProducto
                .map(item => ({
                    id: item.movimientos_almacen.id,
                    type: item.movimientos_almacen.type,
                    fecha: item.movimientos_almacen.fecha,
                    observaciones: item.movimientos_almacen.observaciones,
                    metodo_pago: item.movimientos_almacen.metodo_pago,
                    estado: item.movimientos_almacen.estado,
                    cliente: item.movimientos_almacen.cliente,
                    proveedor: item.movimientos_almacen.proveedor,
                    precio: item.movimientos_almacen.precio,
                    productos: [{
                        cantidad: item.cantidad,
                        precio_unitario: item.precio_unitario,
                        subtotal: item.subtotal,
                        producto: {
                            id: productId,
                            name: 'Producto', // Se puede obtener después si es necesario
                            description: ''
                        }
                    }]
                }))
                // Ordenar por fecha descendente (más reciente primero)
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            return {
                success: true,
                data: movimientosTransformados
            };

        } catch (error) {
            console.error('Error en getByProduct:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener movimientos por cliente (OPTIMIZADO - igual que getAll)
    static async getByCliente(clienteId, sucuId) {
        try {
            if (!clienteId) {
                throw new Error('ID del cliente es requerido');
            }

            if (!sucuId) {
                throw new Error('ID de la sucursal es requerido');
            }

            // Obtener movimientos del cliente con información básica
            const { data: movimientos, error } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name, total_orders),
                    proveedor:proveedores(id, name, total_orders),
                    precio:prices_types(id, name),
                    sucursal:sucu_id(id, name),
                    user:user_id(id, first_name, last_name),
                    personal:personal_id(id, first_name, last_name)
                `)
                .eq('cliente_id', clienteId)
                .eq('sucu_id', sucuId)
                .order('fecha', { ascending: false })
                .limit(50); // Limitar a los últimos 50 movimientos

            if (error) {
                console.error('Error obteniendo movimientos por cliente:', error);
                return { success: false, message: 'Error al obtener movimientos del cliente', error };
            }

            // Si no hay movimientos, retornar array vacío
            if (!movimientos || movimientos.length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            // Hidratación OPTIMIZADA: cargar productos en lote para evitar N+1
            const movimientoIds = movimientos.map(m => m.id);

            // 1) Productos de todos los movimientos en una sola consulta (igual que getAll)
            const { data: productosAll, error: productosError } = await supabase
                .from('movimiento_almacen_producto')
                .select(`
                    movimiento_almacen_id,
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
                .in('movimiento_almacen_id', movimientoIds);

            if (productosError) {
                console.error('Error obteniendo productos:', productosError);
                return { success: false, message: 'Error al obtener productos', error: productosError };
            }

            // Crear mapa de productos por movimiento
            const productosByMovimiento = new Map();
            (movimientoIds || []).forEach(id => productosByMovimiento.set(id, []));
            (productosAll || []).forEach(p => {
                const arr = productosByMovimiento.get(p.movimiento_almacen_id) || [];
                arr.push(p);
                productosByMovimiento.set(p.movimiento_almacen_id, arr);
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
            console.error('Error en movimientosAlmacen.getByCliente:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Actualizar un movimiento
    static async update(id, updateData) {
        try {
            if (!id) {
                throw new Error('ID del movimiento es requerido');
            }

            const { data, error } = await supabase
                .from('movimientos_almacen')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error('Movimiento no encontrado');
                }
                throw new Error(`Error al actualizar el movimiento: ${error.message}`);
            }

            return {
                success: true,
                message: 'Movimiento actualizado exitosamente',
                data: data
            };

        } catch (error) {
            console.error('Error en movimientosAlmacen.update:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Método auxiliar para incrementar total_orders del cliente
    static async incrementarTotalOrdersCliente(clienteId) {
        try {
            if (!clienteId) return { success: true };

            // Primero obtener el valor actual
            const { data: clienteActual, error: fetchError } = await supabase
                .from('clients')
                .select('total_orders')
                .eq('id', clienteId)
                .single();

            if (fetchError) {
                console.error('Error obteniendo total_orders actual:', fetchError);
                return { success: false, message: 'Error al obtener total_orders actual' };
            }

            const nuevoTotal = (clienteActual?.total_orders || 0) + 1;

            const { error } = await supabase
                .from('clients')
                .update({ total_orders: nuevoTotal })
                .eq('id', clienteId);

            if (error) {
                console.error('Error incrementando total_orders del cliente:', error);
                return { success: false, message: 'Error al actualizar contador de órdenes del cliente' };
            }
            return { success: true };
        } catch (error) {
            console.error('Error en incrementarTotalOrdersCliente:', error);
            return { success: false, message: 'Error al incrementar contador de órdenes' };
        }
    }

    // Método auxiliar para decrementar total_orders del cliente
    static async decrementarTotalOrdersCliente(clienteId) {
        try {
            if (!clienteId) return { success: true };

            // Primero obtener el valor actual
            const { data: clienteActual, error: fetchError } = await supabase
                .from('clients')
                .select('total_orders')
                .eq('id', clienteId)
                .single();

            if (fetchError) {
                console.error('❌ [ERROR] Error obteniendo total_orders actual para decrementar:', fetchError);
                return { success: false, message: 'Error al obtener total_orders actual' };
            }

            const nuevoTotal = Math.max((clienteActual?.total_orders || 0) - 1, 0);

            const { error } = await supabase
                .from('clients')
                .update({ total_orders: nuevoTotal })
                .eq('id', clienteId);

            if (error) {
                console.error('❌ [ERROR] Error decrementando total_orders del cliente:', error);
                return { success: false, message: 'Error al actualizar contador de órdenes del cliente' };
            }

            console.log(`✅ [TOTAL_ORDERS] Cliente ${clienteId} - total_orders decrementado`);
            return { success: true };
        } catch (error) {
            console.error('❌ [ERROR] Error en decrementarTotalOrdersCliente:', error);
            return { success: false, message: 'Error al decrementar contador de órdenes' };
        }
    }

    // Método auxiliar para limpieza optimizada de movimientos
    static async cleanupMovimiento(movimientoId) {
        try {
            // Eliminar productos primero (FK constraint)
            await supabase
                .from('movimiento_almacen_producto')
                .delete()
                .eq('movimiento_almacen_id', movimientoId);
            
            // Eliminar movimiento principal
            await supabase
                .from('movimientos_almacen')
                .delete()
                .eq('id', movimientoId);
                
            console.log(`🧹 [CLEANUP] Movimiento ${movimientoId} eliminado correctamente`);
        } catch (error) {
            console.error('Error en limpieza de movimiento:', error);
        }
    }

    // Eliminar productos de un movimiento
    static async deleteProductos(movimientoId) {
        try {
            if (!movimientoId) {
                throw new Error('ID del movimiento es requerido');
            }

            const { error } = await supabase
                .from('movimiento_almacen_producto')
                .delete()
                .eq('movimiento_almacen_id', movimientoId);

            if (error) {
                throw new Error(`Error al eliminar productos del movimiento: ${error.message}`);
            }

            return {
                success: true,
                message: 'Productos del movimiento eliminados exitosamente'
            };

        } catch (error) {
            console.error('Error en movimientosAlmacen.deleteProductos:', error);
            return {
                success: false,
                message: error.message || 'Error al eliminar productos del movimiento'
            };
        }
    }

    // Crear productos de un movimiento
    static async createProductos(movimientoId, productos) {
        try {
            if (!movimientoId) {
                throw new Error('ID del movimiento es requerido');
            }

            if (!productos || !Array.isArray(productos)) {
                throw new Error('Productos son requeridos');
            }

            // Preparar los datos de productos para insertar
            const productosData = productos.map(producto => ({
                movimiento_almacen_id: movimientoId,
                producto_almacen_id: producto.id,
                cantidad: producto.cantidad,
                precio_unitario: producto.precio,
                subtotal: producto.cantidad * producto.precio
            }));

            const { data, error } = await supabase
                .from('movimiento_almacen_producto')
                .insert(productosData)
                .select();

            if (error) {
                throw new Error(`Error al crear productos del movimiento: ${error.message}`);
            }

            return {
                success: true,
                message: 'Productos del movimiento creados exitosamente',
                data: data
            };

        } catch (error) {
            console.error('Error en movimientosAlmacen.createProductos:', error);
            return {
                success: false,
                message: error.message || 'Error al crear productos del movimiento'
            };
        }
    }
}

module.exports = movimientosAlmacen;


