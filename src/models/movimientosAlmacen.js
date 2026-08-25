const { supabase, processBatch, retryOperation, validateBatchResults, CONFIG } = require('../config/supabase');
const deudas = require('./deudas');
const MovimientoLogService = require('../services/movimientoLogService');
const { aplicarFiltroFecha } = require('../utils/fechaRangeHelper');

// Función helper para normalizar texto (quitar acentos)
const normalizeText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .trim();
};

const generarCodigoAleatorio = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
};

const getInitials = (name) => {
    if (!name) return 'XXXX';
    const words = name.trim().toUpperCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return 'XXXX';
    if (words.length === 1) {
        return (words[0] + 'XXXX').substring(0, 4);
    }
    const first = words[0].substring(0, 2);
    const second = words[1].substring(0, 2);
    return (first.padEnd(2, 'X') + second.padEnd(2, 'X'));
};



class movimientosAlmacen {
    // Crear un nuevo movimiento de almacén
    static async create(movimientoData) {
        // Crear instancia de log service
        const logService = new MovimientoLogService();

        try {
            logService.addLog('info', '═══════════════════════════════════════════════════════');
            logService.addLog('info', '🚀 INICIANDO CREACIÓN DE MOVIMIENTO');
            logService.addLog('info', '═══════════════════════════════════════════════════════');

            const { user_id, personal_id, sucu_id, type, observaciones, metodo_pago, cliente_id, proveedor_id, precio_id, productos, restar_ingredientes, produccion_damabrava_id, agrupado, gasto_id, descuento, aumento, fecha, numero_orden, concepto, ubicacion, porcentaje } = movimientoData;

            logService.addLog('info', `Tipo de movimiento: ${type.toUpperCase()}`);
            logService.addLog('info', `Cantidad de productos: ${productos?.length || 0}`);
            logService.addLog('info', `Sucursal ID: ${sucu_id}`);

            // 1️⃣ OBTENER INFORMACIÓN DE LA EMPRESA PRIMERO (para logs y email)
            logService.addLog('info', '📋 Obteniendo información de sucursal y empresa...');

            const { data: sucursalInfo, error: sucursalError } = await supabase
                .from('branches')
                .select(`
                    id,
                    name,
                    empresas:empresa_id (
                        id,
                        name,
                        tipo
                    )
                `)
                .eq('id', sucu_id)
                .single();

            if (sucursalError || !sucursalInfo) {
                logService.addLog('error', 'No se pudo obtener información de la sucursal', { error: sucursalError?.message });
                return { success: false, message: 'No se pudo obtener información de la sucursal' };
            }

            const empresaNombre = sucursalInfo.empresas?.name || 'N/A';
            const sucursalNombre = sucursalInfo.name || 'N/A';

            logService.addLog('success', `Empresa: ${empresaNombre}`);
            logService.addLog('success', `Sucursal: ${sucursalNombre}`);

            // 2️⃣ OBTENER NOMBRES DE PRODUCTOS (para logs mejorados)
            logService.addLog('info', '📦 Obteniendo nombres de productos...');

            const productIds = productos.map(p => p.id);
            const nombresProductos = await logService.getProductosNombres(productIds);

            logService.addLog('success', `Nombres de ${Object.keys(nombresProductos).length} productos obtenidos`);

            // Determinar timestamp para el movimiento
            const fechaActual = new Date();
            let fechaMovimiento = fechaActual;

            if (fecha) {
                const fechaProporcionada = new Date(fecha);
                if (!isNaN(fechaProporcionada.getTime())) {
                    fechaMovimiento = fechaProporcionada;
                }
            }

            const fechaMovimientoISO = fechaMovimiento.toISOString();

            const numeroOrdenProporcionado = (numero_orden !== undefined && numero_orden !== null)
                ? Number(numero_orden)
                : null;

            let numeroOrdenNormalizado = Number.isNaN(numeroOrdenProporcionado) ? null : numeroOrdenProporcionado;
            let nombreEntidad = '';

            if (numeroOrdenNormalizado === null) {
                if (type === 'salida' && cliente_id) {
                    const { data: cliente } = await supabase.from('clients').select('name, total_orders').eq('id', cliente_id).single();
                    if (cliente) {
                        numeroOrdenNormalizado = (cliente.total_orders || 0) + 1;
                        nombreEntidad = cliente.name;
                        await supabase.from('clients').update({ total_orders: numeroOrdenNormalizado }).eq('id', cliente_id);
                    }
                } else if (type === 'entrada' && proveedor_id) {
                    const { data: proveedor } = await supabase.from('suppliers').select('name, total_orders').eq('id', proveedor_id).single();
                    if (proveedor) {
                        numeroOrdenNormalizado = (proveedor.total_orders || 0) + 1;
                        nombreEntidad = proveedor.name;
                        await supabase.from('suppliers').update({ total_orders: numeroOrdenNormalizado }).eq('id', proveedor_id);
                    }
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
                descuento: parseFloat(descuento) || 0,
                aumento: parseFloat(aumento) || 0,
                concepto: concepto && concepto.trim() !== '' ? concepto.trim() : null,
                fecha: fechaMovimientoISO,
                estado: 'finalizado', // Estado por defecto
                codigo: codigoMovimiento,
                porcentaje: (() => {
                    const tieneDescuentoAumento = (parseFloat(descuento) || 0) > 0 || (parseFloat(aumento) || 0) > 0;
                    if (!tieneDescuentoAumento) return null;
                    return porcentaje === true ? true : (porcentaje === false ? false : null);
                })()
            };

            // Si hay ubicación, usarla directamente (igual que en clients.js)
            if (ubicacion) {
                insertData.ubicacion = ubicacion;
            }

            if (numeroOrdenNormalizado !== null) {
                insertData.numero_orden = numeroOrdenNormalizado;
            }

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

            // 3️⃣ VALIDAR STOCK ANTES DE CREAR EL MOVIMIENTO (PARA SALIDAS)
            if (type === 'salida') {
                logService.addLog('info', '🔍 Validando stock disponible ANTES de crear movimiento...');

                // Obtener stocks actuales
                const { data: stocksParaValidacion, error: errorStocksValidacion } = await supabase
                    .from('productos_sucursal')
                    .select('id, producto_id, stock')
                    .eq('sucursal_id', sucu_id)
                    .in('producto_id', productIds);

                if (errorStocksValidacion) {
                    logService.addLog('error', 'Error obteniendo stocks para validación', { error: errorStocksValidacion.message });
                    return { success: false, message: 'Error al validar stocks disponibles' };
                }

                // Crear mapa de stocks
                const stocksMapValidacion = new Map();
                stocksParaValidacion.forEach(stock => {
                    stocksMapValidacion.set(stock.producto_id, { id: stock.id, stock: stock.stock });
                });

                // Validar cada producto
                const productosInvalidos = [];

                for (const producto of productos) {
                    const nombreProducto = nombresProductos[producto.id] || `ID: ${producto.id}`;
                    const stockActual = stocksMapValidacion.get(producto.id);
                    const stockDisponible = stockActual ? stockActual.stock : 0;
                    const cantidadRequerida = producto.cantidad;

                    logService.addLog('info', `Validando "${nombreProducto}": Stock=${stockDisponible}, Requerido=${cantidadRequerida}`);

                    if (stockDisponible < cantidadRequerida) {
                        logService.addLog('error', `❌ Stock insuficiente para "${nombreProducto}"`, {
                            disponible: stockDisponible,
                            requerido: cantidadRequerida,
                            faltante: cantidadRequerida - stockDisponible
                        });

                        productosInvalidos.push({
                            id: producto.id,
                            nombre: nombreProducto,
                            stockDisponible,
                            cantidadRequerida,
                            faltante: cantidadRequerida - stockDisponible
                        });
                    }
                }

                if (productosInvalidos.length > 0) {
                    logService.addLog('error', `⛔ VALIDACIÓN FALLIDA: ${productosInvalidos.length} productos sin stock suficiente`);

                    const detalleError = productosInvalidos.map(p =>
                        `${p.nombre}: necesita ${p.cantidadRequerida}, disponible ${p.stockDisponible} (faltan ${p.faltante})`
                    ).join('; ');

                    return {
                        success: false,
                        message: 'Stock insuficiente para algunos productos',
                        productosInvalidos,
                        detalle: detalleError
                    };
                }

                logService.addLog('success', '✅ Validación de stock completada - todos los productos tienen stock suficiente');
            }

            // Insertar movimiento con timeout y retry
            logService.addLog('info', '📝 Insertando movimiento en BD...');
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .insert(insertData)
                .select('id, sucu_id, type, fecha, estado, user_id, personal_id, precio_id, observaciones, metodo_pago, cliente_id, proveedor_id, restar_ingredientes, produccion_damabrava_id, agrupado, descuento, aumento, numero_orden, concepto, porcentaje, codigo')
                .single();


            if (movimientoError) {
                logService.addLog('error', 'Error creando movimiento', { error: movimientoError.message });
                return { success: false, message: 'Error al crear el movimiento', error: movimientoError };
            }

            logService.addLog('success', `Movimiento creado: ${movimiento.id}`);

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
                        precio_unitario: precio
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

                logService.addLog('info', `📊 Calculando stocks para ${productos.length} productos...`);

                for (const producto of productos) {
                    const nombreProducto = nombresProductos[producto.id] || `Producto ${producto.id}`;
                    const stockActual = stocksMap.get(producto.id);
                    const stockActualValue = stockActual ? stockActual.stock : 0;
                    const stockId = stockActual ? stockActual.id : null;

                    let nuevaCantidad;
                    let operacion = '';

                    if (type === 'entrada') {
                        nuevaCantidad = stockActualValue + producto.cantidad;
                        operacion = `${stockActualValue} + ${producto.cantidad} = ${nuevaCantidad}`;
                    } else if (type === 'salida') {
                        nuevaCantidad = stockActualValue - producto.cantidad;
                        operacion = `${stockActualValue} - ${producto.cantidad} = ${nuevaCantidad}`;

                        // Verificar que hay suficiente stock (esto no debería pasar si la validación previa funcionó)
                        if (nuevaCantidad < 0) {
                            logService.addLog('error', `Stock insuficiente para "${nombreProducto}"`, {
                                disponible: stockActualValue,
                                requerido: producto.cantidad
                            });

                            // Si falla, eliminar el movimiento y sus productos
                            await supabase
                                .from('movimiento_almacen_producto')
                                .delete()
                                .eq('movimiento_almacen_id', movimiento.id);

                            await supabase
                                .from('movimientos_almacen')
                                .delete()
                                .eq('id', movimiento.id);

                            return {
                                success: false,
                                message: `Stock insuficiente para "${nombreProducto}". Stock disponible: ${stockActualValue}, Cantidad requerida: ${producto.cantidad}`,
                                error: 'Stock insuficiente',
                                productoId: producto.id,
                                nombreProducto,
                                stockDisponible: stockActualValue,
                                cantidadRequerida: producto.cantidad
                            };
                        }
                    }

                    // Log detallado de cada producto con nombre
                    logService.addLog('info', `"${nombreProducto}": ${operacion}`);

                    // Guardar stock calculado para respuesta
                    productosConStockCalculado.push({
                        id: producto.id,
                        nombre: nombreProducto,
                        cantidad: producto.cantidad,
                        precio: producto.precio,
                        stock: nuevaCantidad,
                        stockAnterior: stockActualValue,
                        stockNuevo: nuevaCantidad,
                        operacion: operacion
                    });

                    if (stockId) {
                        // Preparar actualización
                        actualizaciones.push({
                            id: stockId,
                            stock: nuevaCantidad,
                            producto_id: producto.id,
                            operacion: operacion,
                            nombreProducto
                        });
                    } else {
                        // Preparar nueva inserción
                        nuevasInserciones.push({
                            producto_id: producto.id,
                            sucursal_id: sucu_id,
                            stock: nuevaCantidad
                        });
                        logService.addLog('info', `🆕 Nuevo stock para "${nombreProducto}": ${nuevaCantidad}`);
                    }
                }

                // 4. Ejecutar actualizaciones en lote con control robusto de errores
                const stocksActualizadosParaRollback = [];

                if (actualizaciones.length > 0) {
                    logService.addLog('info', `🔄 Procesando ${actualizaciones.length} actualizaciones de stock...`);

                    try {
                        // Intentar usar función RPC primero (más eficiente)
                        const rpcResult = await retryOperation(async () => {
                            const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                                stock_updates: actualizaciones.map(a => ({
                                    producto_id: a.producto_id,
                                    sucursal_id: sucu_id,
                                    stock: a.stock
                                }))
                            });

                            if (rpcError) {
                                throw rpcError;
                            }

                            return { success: true };
                        });

                        logService.addLog('success', '✅ Stocks actualizados con RPC atómica');

                    } catch (rpcError) {
                        logService.addLog('warning', `RPC no disponible, usando método por lotes: ${rpcError.message}`);

                        // Fallback: usar método por lotes con control de concurrencia
                        const updateOperations = actualizaciones.map(actualizacion =>
                            retryOperation(async () => {
                                logService.addLog('info', `Actualizando "${actualizacion.nombreProducto}"...`);

                                const { data, error } = await supabase
                                    .from('productos_sucursal')
                                    .update({ stock: actualizacion.stock })
                                    .eq('id', actualizacion.id)
                                    .select('id, stock');

                                if (error) {
                                    logService.addLog('error', `Error actualizando "${actualizacion.nombreProducto}"`, { error: error.message });
                                    throw error;
                                }

                                // Guardar para rollback potencial
                                const stockInfo = productosConStockCalculado.find(p => p.id === actualizacion.producto_id);
                                stocksActualizadosParaRollback.push({
                                    stockId: actualizacion.id,
                                    productoId: actualizacion.producto_id,
                                    stockAnterior: stockInfo?.stockAnterior || 0,
                                    stockNuevo: actualizacion.stock
                                });

                                logService.addLog('success', `✅ "${actualizacion.nombreProducto}" actualizado`);
                                return { data, error: null };
                            })
                        );

                        // Procesar en lotes usando CONFIG.batchSize
                        const { results, errors, summary } = await processBatch(updateOperations, CONFIG.batchSize);

                        // Validar que todas las operaciones fueron exitosas
                        try {
                            validateBatchResults(results);
                            logService.addLog('success', `✅ Todos los stocks actualizados (${summary.successRate})`);
                        } catch (validationError) {
                            logService.addLog('error', 'Error en validación de stocks', { error: validationError.message });
                            // Limpieza con rollback
                            await this.cleanupMovimiento(movimiento.id, stocksActualizadosParaRollback, logService);
                            return {
                                success: false,
                                message: 'Error al actualizar stocks: ' + validationError.message,
                                error: validationError
                            };
                        }

                        // Si hay errores en el procesamiento por lotes, fallar completamente
                        if (errors.length > 0) {
                            logService.addLog('error', `Errores en procesamiento: ${errors.length} fallidos`);
                            await this.cleanupMovimiento(movimiento.id, stocksActualizadosParaRollback, logService);
                            return {
                                success: false,
                                message: 'Error al procesar actualizaciones de stock',
                                error: errors
                            };
                        }
                    }
                }

                // 5. Ejecutar inserciones en lote con control robusto de errores
                if (nuevasInserciones.length > 0) {
                    logService.addLog('info', `🆕 Insertando ${nuevasInserciones.length} nuevos stocks...`);

                    try {
                        const insertResult = await retryOperation(async () => {
                            const { data, error } = await supabase
                                .from('productos_sucursal')
                                .insert(nuevasInserciones)
                                .select('id');

                            if (error) {
                                logService.addLog('error', 'Error insertando stocks', { error: error.message });
                                throw error;
                            }

                            logService.addLog('success', '✅ Nuevos stocks creados exitosamente');
                            return { data, error: null };
                        });

                    } catch (insertError) {
                        logService.addLog('error', 'Error al crear stocks', { error: insertError.message });
                        // Limpieza con rollback
                        await this.cleanupMovimiento(movimiento.id, stocksActualizadosParaRollback, logService);
                        return {
                            success: false,
                            message: 'Error al crear stocks: ' + insertError.message,
                            error: insertError
                        };
                    }
                }

            }

            let numeroOrdenAsignado = insertData.numero_orden ?? null;

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
                agrupado: movimiento.agrupado,
                descuento: movimiento.descuento,
                aumento: movimiento.aumento,
                concepto: movimiento.concepto,
                numero_orden: movimiento.numero_orden ?? numeroOrdenAsignado,
                porcentaje: movimiento.porcentaje
            };

            // Usar productos con stock calculado (ya calculado arriba) o preparar fallback
            let productosConStock;
            if (productos && productos.length > 0) {
                // Si se procesaron productos, usar el stock calculado
                if (typeof productosConStockCalculado !== 'undefined' && productosConStockCalculado && productosConStockCalculado.length > 0) {
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


            // Eliminar lógica redundante de incremento de total_orders, ya se hizo al principio
            movimientoBasico.numero_orden = numeroOrdenAsignado;

            // 6️⃣ ENVIAR EMAIL CON LOGS (solo para empresa "hhco")
            logService.addLog('info', '═══════════════════════════════════════════════════════');
            logService.addLog('success', '🎉 MOVIMIENTO CREADO EXITOSAMENTE');
            logService.addLog('info', '═══════════════════════════════════════════════════════');

            return {
                success: true,
                data: {
                    ...movimientoBasico,
                    productos: productosConStock,
                    numero_orden: numeroOrdenAsignado,
                    empresa: empresaNombre,
                    sucursal: sucursalNombre
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.create:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Inserción de golpe rápida
    static async createFast(movimientoData) {
        try {
            const { user_id, personal_id, sucu_id, type, metodo_pago, cliente_id, proveedor_id, precio_id, productos, descuento, aumento, concepto, porcentaje, agrupado, restar_ingredientes, fecha } = movimientoData;

            let numeroOrdenFinal = null;
            let nombreEntidad = '';

            if (type === 'salida' && cliente_id) {
                const { data: cliente } = await supabase.from('clients').select('name, total_orders').eq('id', cliente_id).single();
                if (cliente) {
                    numeroOrdenFinal = (cliente.total_orders || 0) + 1;
                    nombreEntidad = cliente.name;
                    await supabase.from('clients').update({ total_orders: numeroOrdenFinal }).eq('id', cliente_id);
                }
            } else if (type === 'entrada' && proveedor_id) {
                const { data: proveedor } = await supabase.from('suppliers').select('name, total_orders').eq('id', proveedor_id).single();
                if (proveedor) {
                    numeroOrdenFinal = (proveedor.total_orders || 0) + 1;
                    nombreEntidad = proveedor.name;
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
                metodo_pago,
                cliente_id,
                proveedor_id,
                precio_id,
                user_id,
                descuento,
                aumento,
                concepto,
                porcentaje,
                agrupado: !!agrupado,
                fecha: fechaMovimientoISO,
                estado: 'finalizado',
                numero_orden: numeroOrdenFinal,
                codigo: codigoMovimiento,
                restar_ingredientes
            };

            // 1. Insertar movimiento
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .insert(insertData)
                .select('id')
                .single();

            if (movimientoError) {
                console.error('❌ Supabase error en createFast:', JSON.stringify(movimientoError));
                console.error('❌ insertData:', JSON.stringify(insertData));
                return { success: false, message: 'Error al crear el movimiento rápido', error: movimientoError, detail: movimientoError?.message };
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
            console.error('Error en MovimientosAlmacen.createFast:', error);
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

    // Obtener todos los movimientos de una sucursal
    static async getAll(sucuId, page = 1, limit = 30, tipo = null, estado = null, ordenamiento = 'fecha_desc', search = null, clienteId = null, filtroFecha = null) {
        try {
            const tStart = Date.now();
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
                const normalizedSearchTerm = normalizeText(search);
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

    // Obtener todos los movimientos sin límite (Optimizado para reportes/balance)
    static async getAllSinLimite(sucuId, tipo = null, estado = null, ordenamiento = 'fecha_desc', filtroFecha = null) {
        try {
            let query = supabase
                .from('movimientos_almacen')
                .select('id, fecha, metodo_pago, type, estado, descuento, aumento, porcentaje, agrupado')
                .eq('sucu_id', sucuId);

            if (tipo) query = query.eq('type', tipo);
            if (estado) query = query.eq('estado', estado);

            query = aplicarFiltroFecha(query, 'fecha', filtroFecha);

            const ascending = ordenamiento === 'fecha_asc';
            query = query.order('fecha', { ascending });

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

    // Obtener estadísticas optimizadas para gráficos (solo campos necesarios)
    static async getStatsForCharts(sucuId) {
        try {
            const ahora = new Date();
            const añoActual = ahora.getFullYear();
            const inicioAño = new Date(añoActual, 0, 1).toISOString();
            const finAño = new Date(añoActual, 11, 31, 23, 59, 59).toISOString();

            // Obtener solo los campos necesarios: fecha, type, estado
            const { data: movimientos, error } = await supabase
                .from('movimientos_almacen')
                .select(`
                    id,
                    fecha,
                    type,
                    estado
                `)
                .eq('sucu_id', sucuId)
                .gte('fecha', inicioAño)
                .lte('fecha', finAño)
                .order('fecha', { ascending: true });

            if (error) {
                console.error('Error obteniendo estadísticas de movimientos:', error);
                return { success: false, message: 'Error al obtener estadísticas', error };
            }

            if (!movimientos || movimientos.length === 0) {
                return {
                    success: true,
                    data: []
                };
            }

            // Obtener productos solo para salidas no anuladas (para calcular ventas)
            const movimientosSalidas = movimientos.filter(m => m.type === 'salida' && m.estado !== 'anulado');
            const movimientoIdsSalidas = movimientosSalidas.map(m => m.id);

            let productosData = [];
            if (movimientoIdsSalidas.length > 0) {
                const { data: productos, error: productosError } = await supabase
                    .from('movimiento_almacen_producto')
                    .select(`
                        movimiento_almacen_id,
                        cantidad,
                        precio_unitario
                    `)
                    .in('movimiento_almacen_id', movimientoIdsSalidas);

                if (productosError) {
                    console.error('Error obteniendo productos para estadísticas:', productosError);
                    // Continuar sin productos, solo con fechas
                } else {
                    productosData = productos || [];
                }
            }

            // Agrupar productos por movimiento
            const productosByMovimiento = new Map();
            productosData.forEach(p => {
                const arr = productosByMovimiento.get(p.movimiento_almacen_id) || [];
                arr.push({
                    cantidad: p.cantidad,
                    precio_unitario: p.precio_unitario
                });
                productosByMovimiento.set(p.movimiento_almacen_id, arr);
            });

            // Combinar movimientos con sus productos
            const movimientosConProductos = movimientos.map(mov => {
                const productos = productosByMovimiento.get(mov.id) || [];
                return {
                    fecha: mov.fecha,
                    type: mov.type,
                    estado: mov.estado,
                    productos: productos
                };
            });

            return {
                success: true,
                data: movimientosConProductos
            };

        } catch (error) {
            console.error('Error en movimientosAlmacen.getStatsForCharts:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    static async getCategoriasMasVendidas(sucuId) {
        try {
            const ahora = new Date();
            const y = ahora.getFullYear();
            const m = ahora.getMonth();
            const inicioMes = new Date(y, m, 1).toISOString();
            const finMes = new Date(y, m + 1, 0, 23, 59, 59).toISOString();

            const { data: movimientos, error: movsError } = await supabase
                .from('movimientos_almacen')
                .select('id')
                .eq('sucu_id', sucuId)
                .eq('type', 'salida')
                .neq('estado', 'anulado')
                .gte('fecha', inicioMes)
                .lte('fecha', finMes);

            if (movsError) throw movsError;
            if (!movimientos || movimientos.length === 0) {
                return { success: true, data: { categorias: [], totalProductos: 0 } };
            }

            const movIds = movimientos.map(m => m.id);

            const { data: productosVendidos, error: prodError } = await supabase
                .from('movimiento_almacen_producto')
                .select(`
                    cantidad,
                    producto_almacen:producto_almacen_id (
                        id,
                        name,
                        producto_categoria (
                            category_almacen:categoria_id (
                                id,
                                name
                            )
                        )
                    )
                `)
                .in('movimiento_almacen_id', movIds);

            if (prodError) throw prodError;

            const conteoCategorias = {};
            let totalProductos = 0;

            (productosVendidos || []).forEach(item => {
                const cantidad = parseFloat(item.cantidad) || 0;
                const prod = item.producto_almacen;
                if (!prod) return;

                totalProductos += cantidad;

                const cats = prod.producto_categoria || [];
                const categoryName = cats.length > 0 && cats[0].category_almacen?.name
                    ? cats[0].category_almacen.name
                    : 'Sin categoría';

                conteoCategorias[categoryName] = (conteoCategorias[categoryName] || 0) + cantidad;
            });

            const colores = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444'];
            const datosCategorias = Object.keys(conteoCategorias).map((nombre, index) => ({
                nombre,
                valor: Math.round(conteoCategorias[nombre]),
                color: colores[index % colores.length]
            })).sort((a, b) => b.valor - a.valor);

            const top6Categorias = datosCategorias.slice(0, 6);

            return {
                success: true,
                data: {
                    categorias: top6Categorias,
                    totalProductos: Math.round(totalProductos)
                }
            };
        } catch (error) {
            console.error('Error en getCategoriasMasVendidas:', error);
            return { success: false, message: error.message };
        }
    }

    // Obtener movimientos por tipo (entrada/salida)
    static async getByType(sucuId, type, page = 1, limit = 30) {
        try {
            const offset = (page - 1) * limit;

            const { data: movimientos, error, count } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:suppliers(id, name),
                    precio:prices_types(id, name)
                `, { count: 'estimated' })
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
                .select('id, sucu_id, type, estado, restar_ingredientes, produccion_damabrava_id, cliente_id, deuda_id')
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

            // Validar pedidos relacionados (ULTRA OPTIMIZADO)
            const { data: pedidosRelacionados, error: pedidosError } = await supabase
                .from('pedidos_almacen')
                .select('id, estado, movimiento_salida_id, movimiento_entrada_id')
                .or(`movimiento_salida_id.eq.${movimientoId},movimiento_entrada_id.eq.${movimientoId}`)
                .limit(1)
                .maybeSingle(); // Usar maybeSingle para mejor performance

            if (pedidosError) {
                console.error('Error validando pedidos relacionados:', pedidosError);
                return { success: false, message: 'Error al validar pedidos relacionados' };
            }

            // Si es un movimiento de salida relacionado con pedido, no permitir anular (solo desde pedido)
            if (pedidosRelacionados && pedidosRelacionados.movimiento_salida_id === movimientoId && !desdePedido) {
                return { success: false, message: 'No se puede anular: el movimiento de salida está relacionado con un pedido. Debe cancelar la entrega desde el pedido' };
            }

            // Si es un movimiento de entrada relacionado con pedido, permitir anular y actualizar el pedido
            let esEntradaDePedido = false;
            if (pedidosRelacionados && pedidosRelacionados.movimiento_entrada_id === movimientoId && movimiento.type === 'entrada') {
                esEntradaDePedido = true;
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
            const productosConStockInsuficiente = [];
            console.log(`🔄 [ANULAR] Preparando reversión de ${movimiento.productos.length} productos (${movimiento.type})`);

            for (const productoMovimiento of movimiento.productos) {
                const cantidadMovimiento = parseFloat(productoMovimiento.cantidad);
                const stockActual = stocksMap.get(productoMovimiento.producto_almacen_id);
                const stockActualValue = stockActual ? stockActual.stock : 0;
                const stockId = stockActual ? stockActual.id : null;

                let nuevaCantidad;
                let operacionReversion = '';

                if (movimiento.type === 'entrada') {
                    nuevaCantidad = stockActualValue - cantidadMovimiento;
                    operacionReversion = `${stockActualValue} - ${cantidadMovimiento} = ${nuevaCantidad}`;

                    // Validar stock suficiente para restar (anular entrada)
                    if (nuevaCantidad < 0) {
                        // Obtener nombre del producto para el error
                        const { data: productoInfo } = await supabase
                            .from('products_almacen')
                            .select('name')
                            .eq('id', productoMovimiento.producto_almacen_id)
                            .single();

                        productosConStockInsuficiente.push({
                            nombre: productoInfo?.name || 'Producto desconocido',
                            stockActual: stockActualValue,
                            requerido: cantidadMovimiento,
                            faltante: Math.abs(nuevaCantidad)
                        });
                        console.log(`❌ [ANULAR] Stock insuficiente para anular entrada: ${productoInfo?.name || productoMovimiento.producto_almacen_id}`);
                        continue;
                    }
                } else {
                    nuevaCantidad = stockActualValue + cantidadMovimiento;
                    operacionReversion = `${stockActualValue} + ${cantidadMovimiento} = ${nuevaCantidad}`;
                }

                console.log(`🔄 [REVERSIÓN] Producto ${productoMovimiento.producto_almacen_id} | ${operacionReversion}`);

                if (stockId) {
                    actualizacionesReversion.push({
                        id: stockId,
                        stock: nuevaCantidad,
                        producto_id: productoMovimiento.producto_almacen_id,
                        operacion: operacionReversion
                    });
                }
            }

            // Si hay productos con stock insuficiente, retornar error
            if (productosConStockInsuficiente.length > 0) {
                console.log('❌ [ANULAR] No se puede anular: stock insuficiente en algunos productos');
                return {
                    success: false,
                    message: 'No es posible anular esta entrada por que algunos productos ya no existen en stock o se vendieron',
                    productosConStockInsuficiente
                };
            }

            // Usar función RPC específica para anular (ATÓMICA) - UNA SOLA OPERACIÓN
            let rpcSuccess = false;

            try {
                const rpcResult = await retryOperation(async () => {
                    const { error: rpcError } = await supabase.rpc('anular_movimiento_batch', {
                        movimiento_id: movimientoId,
                        stock_updates: actualizacionesReversion
                    });

                    if (rpcError) {
                        throw rpcError;
                    }

                    return { success: true };
                });

                rpcSuccess = true;
                console.log(`✅ [MODEL ANULAR] RPC completado exitosamente - NO se necesita reversión manual`);

            } catch (rpcError) {
                console.warn('⚠️ [MODEL ANULAR] RPC anular_movimiento_batch no disponible, usando método tradicional:', rpcError.message);

                // Fallback: método tradicional (solo actualizar estado)
                try {
                    const updateResult = await retryOperation(async () => {
                        const { error: updateError } = await supabase
                            .from('movimientos_almacen')
                            .update({ estado: 'anulado' })
                            .eq('id', movimientoId)
                            .select('id')
                            .single();

                        if (updateError) {
                            throw updateError;
                        }

                        return { success: true };
                    });

                } catch (updateError) {
                    console.error('❌ [MODEL ANULAR] Error actualizando estado:', updateError);
                    return { success: false, message: 'Error al anular el movimiento: ' + updateError.message };
                }

                rpcSuccess = false;
            }

            // Solo hacer reversión manual si el RPC falló
            if (!rpcSuccess && actualizacionesReversion.length > 0) {
                console.log(`🔄 [MODEL ANULAR] Realizando reversión manual de ${actualizacionesReversion.length} stocks`);

                try {
                    // Usar función RPC para actualizaciones en lote
                    const rpcResult = await retryOperation(async () => {
                        const { error: rpcError } = await supabase.rpc('update_stocks_batch', {
                            stock_updates: actualizacionesReversion
                        });

                        if (rpcError) {
                            throw rpcError;
                        }

                        return { success: true };
                    });

                    console.log('✅ [MODEL ANULAR] Reversión RPC completada exitosamente');

                } catch (rpcError) {
                    console.warn('⚠️ [MODEL ANULAR] RPC no disponible para reversión manual, usando método por lotes:', rpcError.message);

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
                        console.log('✅ [MODEL ANULAR] Reversión manual completada exitosamente');
                    } catch (validationError) {
                        console.error('❌ [MODEL ANULAR] Error en reversión manual:', validationError.message);
                        // Revertir el estado del movimiento
                        await supabase
                            .from('movimientos_almacen')
                            .update({ estado: 'finalizado' })
                            .eq('id', movimientoId);
                        return {
                            success: false,
                            message: 'Error al revertir stocks manualmente: ' + validationError.message,
                            error: validationError
                        };
                    }

                    // Si hay errores en el procesamiento por lotes, fallar completamente
                    if (errors.length > 0) {
                        console.error('❌ [MODEL ANULAR] Errores en procesamiento por lotes:', errors);
                        // Revertir el estado del movimiento
                        await supabase
                            .from('movimientos_almacen')
                            .update({ estado: 'finalizado' })
                            .eq('id', movimientoId);
                        return {
                            success: false,
                            message: 'Error al procesar reversión de stocks',
                            error: errors
                        };
                    }
                }
            } else if (rpcSuccess) {
                console.log(`✅ [MODEL ANULAR] RPC exitoso - Saltando reversión manual redundante`);
            }

            // Eliminar deudas asociadas a este movimiento (si las hubiera)
            try {
                if (movimiento.deuda_id) {
                    const { error: limpiarDeudaIdError } = await supabase
                        .from('movimientos_almacen')
                        .update({ deuda_id: null })
                        .eq('id', movimientoId);

                    if (limpiarDeudaIdError) {
                        console.error('Error limpiando deuda_id antes de eliminar deuda:', limpiarDeudaIdError);
                    }
                }

                const deleteDeudasResult = await deudas.deleteByMovimientoSalidaId(movimientoId);
                if (!deleteDeudasResult.success && movimiento.deuda_id) {
                    const deleteDeudaDirecto = await deudas.delete(movimiento.deuda_id);
                    if (!deleteDeudaDirecto.success) {
                        console.warn('⚠️ [ANULAR] No se pudieron eliminar deudas asociadas:', deleteDeudaDirecto.message);
                    }
                }
            } catch (e) {
                console.warn('⚠️ [ANULAR] Error eliminando deudas asociadas al movimiento:', e.message);
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

            // Si es una entrada de pedido, actualizar el pedido
            if (esEntradaDePedido && pedidosRelacionados) {
                console.log(`🔄 [ANULAR] Actualizando pedido relacionado: ${pedidosRelacionados.id}`);
                const { error: updatePedidoError } = await supabase
                    .from('pedidos_almacen')
                    .update({
                        estado: 'Entregado',
                        movimiento_entrada_id: null
                    })
                    .eq('id', pedidosRelacionados.id);

                if (updatePedidoError) {
                    console.error('Error actualizando pedido al anular entrada:', updatePedidoError);
                    // No falla la anulación si falla la actualización del pedido, solo loguea el error
                    console.warn('⚠️ [ANULAR] El movimiento se anuló pero no se pudo actualizar el pedido');
                } else {
                    console.log(`✅ [ANULAR] Pedido actualizado: estado='Entregado', movimiento_entrada_id=null`);
                }
            }

            // Limpiar la referencia al registro de producción para que pueda ser eliminado
            if (movimiento.produccion_damabrava_id) {
                const { error: limpiarDamabravaError } = await supabase
                    .from('movimientos_almacen')
                    .update({ produccion_damabrava_id: null })
                    .eq('id', movimientoId);

                if (limpiarDamabravaError) {
                    console.error('Error limpiando produccion_damabrava_id:', limpiarDamabravaError);
                } else {
                    console.log(`✅ [ANULAR] Limpiada la referencia a producción damabrava: ${movimiento.produccion_damabrava_id}`);
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
                if (movimiento.deuda_id) {
                    const { error: limpiarDeudaIdError } = await supabase
                        .from('movimientos_almacen')
                        .update({ deuda_id: null })
                        .eq('id', movimientoId);

                    if (limpiarDeudaIdError) {
                        console.error('Error limpiando deuda_id antes de eliminar el movimiento:', limpiarDeudaIdError);
                    }
                }

                const deleteDeudas = await deudas.deleteByMovimientoSalidaId(movimientoId);
                if (!deleteDeudas.success && movimiento.deuda_id) {
                    const deleteDeudaDirecto = await deudas.delete(movimiento.deuda_id);
                    if (!deleteDeudaDirecto.success) {
                        console.warn('⚠️ [ELIMINAR] No se pudieron eliminar deudas asociadas:', deleteDeudaDirecto.message);
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

            const { data: movimientos, error: movimientosError } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name, total_orders),
                    proveedor:suppliers(id, name, total_orders),
                    precio:prices_types(id, name),
                    sucursal:sucu_id(id, name),
                    user:user_id(id, first_name, last_name),
                    personal:personal_id(id, first_name, last_name),
                    productos:movimiento_almacen_producto!inner(
                        movimiento_almacen_id,
                        producto_almacen_id,
                        cantidad,
                        precio_unitario,
                        producto:producto_almacen_id(
                            id,
                            name,
                            description,
                            grup
                        )
                    )
                `)
                .eq('sucu_id', sucuId)
                .eq('movimiento_almacen_producto.producto_almacen_id', productId)
                .order('fecha', { ascending: false })
                .limit(limit);

            if (movimientosError) {
                console.error('Error obteniendo movimientos:', movimientosError);
                return { success: false, message: 'Error al obtener movimientos', error: movimientosError };
            }

            let pedidosMap = new Map();
            if (movimientos && movimientos.length > 0) {
                const idsList = movimientos.map(m => m.id).join(',');
                if (idsList) {
                    const orFilters = [
                        `movimiento_salida_id.in.(${idsList})`,
                        `movimiento_entrada_id.in.(${idsList})`
                    ].join(',');

                    const { data: pedidosRelacionados, error: pedidosError } = await supabase
                        .from('pedidos_almacen')
                        .select('movimiento_salida_id, movimiento_entrada_id')
                        .or(orFilters);

                    if (pedidosError) {
                        console.warn('Error obteniendo pedidos relacionados:', pedidosError);
                    } else if (pedidosRelacionados) {
                        pedidosMap = pedidosRelacionados.reduce((map, pedido) => {
                            if (pedido.movimiento_salida_id) {
                                map.set(pedido.movimiento_salida_id, true);
                            }
                            if (pedido.movimiento_entrada_id) {
                                map.set(pedido.movimiento_entrada_id, true);
                            }
                            return map;
                        }, new Map());
                    }
                }
            }

            const movimientosMap = new Map();

            (movimientos || []).forEach(movimiento => {
                const { productos = [], user: userRaw, personal: personalRaw, ...restoMovimiento } = movimiento;

                const user = userRaw
                    ? {
                        id: userRaw.id,
                        name: `${userRaw.first_name || ''} ${userRaw.last_name || ''}`.trim()
                    }
                    : null;

                const personal = personalRaw
                    ? {
                        id: personalRaw.id,
                        name: `${personalRaw.first_name || ''} ${personalRaw.last_name || ''}`.trim()
                    }
                    : null;

                const existente = movimientosMap.get(movimiento.id);
                if (existente) {
                    movimientosMap.set(movimiento.id, {
                        ...existente,
                        productos: [...existente.productos, ...productos]
                    });
                } else {
                    movimientosMap.set(movimiento.id, {
                        ...restoMovimiento,
                        user,
                        personal,
                        productos: productos || [],
                        tiene_pedido_relacionado: pedidosMap.get(movimiento.id) || false
                    });
                }
            });

            const movimientosOrdenados = Array.from(movimientosMap.values())
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            return {
                success: true,
                data: movimientosOrdenados
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
                    proveedor:suppliers(id, name, total_orders),
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
                    console.error(`[MovAlmacenModel.getByCliente] Error obteniendo productos (lote ${Math.floor(i / batchSize) + 1}):`, productosError);
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
                    console.error(`[MovAlmacenModel.getByCliente] Error obteniendo productos almacén (lote ${Math.floor(i / productoBatchSize) + 1}):`, productosAlmacenError);
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
            console.error('Error en movimientosAlmacen.getByCliente:', error);
            return { success: false, message: 'Error interno del servidor', error };
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
    static async cleanupMovimiento(movimientoId, stocksActualizados = [], logService = null) {
        try {
            const log = logService || { addLog: (level, msg) => console.log(`[${level}] ${msg}`) };

            log.addLog('warning', `🧹 Iniciando limpieza de movimiento ${movimientoId}`);

            // 1. REVERTIR stocks si hay registros
            if (stocksActualizados && stocksActualizados.length > 0) {
                log.addLog('info', `🔄 Revirtiendo ${stocksActualizados.length} stocks...`);

                const revertOperations = stocksActualizados.map(stock =>
                    retryOperation(async () => {
                        const { error } = await supabase
                            .from('productos_sucursal')
                            .update({ stock: stock.stockAnterior })
                            .eq('id', stock.stockId);

                        if (error) {
                            throw error;
                        }

                        log.addLog('success', `Revertido stock de producto ${stock.productoId}: ${stock.stockNuevo} → ${stock.stockAnterior}`);

                        return { success: true };
                    })
                );

                const { summary } = await processBatch(revertOperations, 10); // Lotes pequeños para rollback

                log.addLog('success', `✅ Stocks revertidos: ${summary.successful}/${summary.total}`);
            }

            // 2. Eliminar productos del movimiento
            log.addLog('info', 'Eliminando productos del movimiento...');
            await supabase
                .from('movimiento_almacen_producto')
                .delete()
                .eq('movimiento_almacen_id', movimientoId);

            // 3. Eliminar movimiento
            log.addLog('info', 'Eliminando movimiento...');
            await supabase
                .from('movimientos_almacen')
                .delete()
                .eq('id', movimientoId);

            log.addLog('success', `✅ Movimiento ${movimientoId} eliminado correctamente`);
            return { success: true };
        } catch (error) {
            console.error('❌ Error en limpieza:', error);
            return { success: false, error };
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
                precio_unitario: producto.precio
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

    // Método para devolver ingredientes (sumar al stock)
    static async devolverIngredientes(producto, cantidad, ingredientes, empresaId) {
        try {
            if (!ingredientes || ingredientes.length === 0) {
                return { success: true, message: 'No hay ingredientes para devolver' };
            }

            const ingredientesDevueltos = [];

            // Devolver ingredientes (sumar al stock)
            for (const ingrediente of ingredientes) {
                if (!ingrediente.products_acopio || !ingrediente.products_acopio.id) {
                    continue;
                }

                const cantidadADevolver = ingrediente.cantidad * cantidad;
                const cantidadActual = ingrediente.products_acopio.quantity;
                const nuevaCantidadIngrediente = cantidadActual + cantidadADevolver;

                const { error: ingredienteError } = await supabase
                    .from('products_acopio')
                    .update({ quantity: nuevaCantidadIngrediente })
                    .eq('id', ingrediente.products_acopio.id);

                if (ingredienteError) {
                    // Continuar con el siguiente ingrediente
                } else {
                    ingredientesDevueltos.push({
                        nombre: ingrediente.products_acopio.name,
                        cantidad: cantidadADevolver
                    });
                }
            }

            return {
                success: true,
                message: `Ingredientes devueltos correctamente: ${ingredientesDevueltos.length} ingredientes`,
                ingredientesDevueltos: ingredientesDevueltos
            };

        } catch (error) {
            console.error('❌ [DEVOLVER INGREDIENTES] Error en devolverIngredientes:', error);
            return {
                success: false,
                message: 'Error interno al devolver ingredientes: ' + error.message
            };
        }
    }

    // Anular un movimiento de forma rápida revirtiendo stock de golpe
    static async anularFast(movimientoId) {
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
                    console.error('Error obteniendo registro de producción en anularFast:', registroError);
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
                        console.error('Error actualizando registro de producción en anularFast:', updateRegistroError);
                        return { success: false, message: 'Error al actualizar el registro de producción' };
                    }
                    console.log(`Registro de producción ${movimiento.produccion_damabrava_id} actualizado (anularFast): cantidad_ingresada=${nuevaCantidadIngresada}, estado=${nuevoEstado}`);
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

                    for (const producto of productos) {
                        const prodData = productosMap.get(producto.producto_almacen_id);
                        if (prodData && prodData.recetas && prodData.recetas.length > 0) {
                            const receta = prodData.recetas[0];
                            if (receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                                await movimientosAlmacen.devolverIngredientes(
                                    prodData,
                                    producto.cantidad,
                                    receta.recetas_detalle,
                                    null
                                );
                            }
                        }
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
            console.error('Error en anularFast:', error);
            return { success: false, message: 'Error interno en anularFast', error };
        }
    }

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
}

module.exports = movimientosAlmacen;
