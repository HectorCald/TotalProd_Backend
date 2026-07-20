const { supabase } = require('../config/supabase');

// Función para generar código aleatorio de 8 caracteres alfanuméricos
const generarCodigoAleatorio = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
};

// Función para generar código de cotización
const generarCodigoCotizacion = () => {
    const codigoAleatorio = generarCodigoAleatorio();
    return `CTZ-${codigoAleatorio}`;
};

const COTIZACION_SELECT = `
    id,
    numero_cotizacion,
    codigo,
    fecha,
    observaciones,
    metodo_pago,
    estado,
    total,
    fecha_vencimiento,
    agrupado,
    descuento,
    aumento,
    porcentaje,
    precio_id,
    user_id,
    personal_id,
    sucu_id,
    cliente_id,
    user:user_id(id, first_name, last_name),
    personal:personal_id(id, first_name, last_name),
    cliente:cliente_id(id, name),
    precio:precio_id(id, name),
    sucursales:sucu_id(id, name)
`;

class cotizaciones {
    // Crear cotización rápida de golpe (igual que createFast de movimientos)
    static async createFast(cotizacionData) {
        try {
            const {
                user_id, personal_id, sucu_id,
                metodo_pago, cliente_id, precio_id,
                productos, fecha_vencimiento,
                agrupado, descuento, aumento, porcentaje
            } = cotizacionData;

            // Obtener último número de cotización de la sucursal
            const { data: ultimaCotizacion, error: errorNumero } = await supabase
                .from('cotizaciones')
                .select('numero_cotizacion')
                .eq('sucu_id', sucu_id)
                .order('numero_cotizacion', { ascending: false })
                .limit(1)
                .maybeSingle();

            const numeroCotizacion = (!errorNumero && ultimaCotizacion)
                ? (ultimaCotizacion.numero_cotizacion || 0) + 1
                : 1;

            // Generar código CA-XXNNN
            const genAlfanumerico = () => {
                const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                const nums = '0123456789';
                const l = () => letras[Math.floor(Math.random() * letras.length)];
                const n = () => nums[Math.floor(Math.random() * nums.length)];
                return `${l()}${l()}${n()}${n()}${n()}`;
            };
            const codigoCotizacion = `CA-${genAlfanumerico()}`;

            const normalizarDecimal = (valor, decimales = 2) => {
                const numero = Number(valor);
                if (!Number.isFinite(numero)) return 0;
                return Number(numero.toFixed(decimales));
            };

            const productosNormalizados = (productos || []).map(producto => {
                const cantidad = Number(producto.cantidad) || 0;
                const precioUnitario = normalizarDecimal(producto.precio);
                const subtotal = normalizarDecimal(precioUnitario * cantidad);
                return { ...producto, cantidad, precioNormalizado: precioUnitario, subtotalNormalizado: subtotal };
            });

            const insertData = {
                sucu_id,
                metodo_pago: metodo_pago ? metodo_pago.toUpperCase() : null,
                cliente_id: cliente_id || null,
                precio_id: precio_id || null,
                agrupado: !!agrupado,
                fecha: new Date().toISOString(),
                fecha_vencimiento: fecha_vencimiento || null,
                estado: 'pendiente',
                numero_cotizacion: numeroCotizacion,
                codigo: codigoCotizacion,
                descuento: normalizarDecimal(descuento),
                aumento: normalizarDecimal(aumento),
                porcentaje: (() => {
                    const tieneDescuentoAumento = normalizarDecimal(descuento) > 0 || normalizarDecimal(aumento) > 0;
                    if (!tieneDescuentoAumento) return null;
                    return porcentaje === true ? true : (porcentaje === false ? false : null);
                })()
            };

            if (user_id) insertData.user_id = user_id;
            if (personal_id) insertData.personal_id = personal_id;

            // 1. Insertar cotización
            const { data: cotizacion, error: cotizacionError } = await supabase
                .from('cotizaciones')
                .insert(insertData)
                .select('id, numero_cotizacion, codigo, sucu_id, estado, fecha, metodo_pago, cliente_id, precio_id, agrupado, fecha_vencimiento, descuento, aumento, porcentaje')
                .single();

            if (cotizacionError) {
                console.error('Error en createFast - insertar cotización:', cotizacionError);
                return { success: false, message: 'Error al crear la cotización', error: cotizacionError };
            }

            // 2. Insertar detalles
            if (productosNormalizados.length > 0) {
                const productosData = productosNormalizados.map(producto => ({
                    cotizacion_id: cotizacion.id,
                    producto_almacen_id: producto.id,
                    cantidad: producto.cantidad,
                    precio_unitario: producto.precioNormalizado,
                    subtotal: producto.subtotalNormalizado
                }));

                const { error: productosError } = await supabase
                    .from('cotizacion_detalle')
                    .insert(productosData)
                    .select('id');

                if (productosError) {
                    console.error('Error en createFast - insertar detalle:', productosError);
                    await this.cleanupCotizacion(cotizacion.id);
                    return { success: false, message: 'Error al crear los detalles de la cotización', error: productosError };
                }
            }

            return {
                success: true,
                data: {
                    ...cotizacion,
                    productos: productosNormalizados.map(p => ({
                        id: p.id,
                        cantidad: p.cantidad,
                        precio: p.precioNormalizado,
                        subtotal: p.subtotalNormalizado
                    }))
                }
            };

        } catch (error) {
            console.error('Error en Cotizaciones.createFast:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Crear una nueva cotización
    static async create(cotizacionData) {
        try {
            const { user_id, personal_id, sucu_id, observaciones, metodo_pago, cliente_id, productos, fecha_vencimiento, agrupado, precio_id, descuento, aumento, porcentaje } = cotizacionData;

            // Crear timestamp en zona horaria de Bolivia (GMT-4) - CORREGIDO
            const ahora = new Date();
            const ahoraBolivia = ahora; // Usar directamente la hora local del sistema

            // Obtener el siguiente número de cotización para esta sucursal
            const { data: ultimaCotizacion, error: errorNumero } = await supabase
                .from('cotizaciones')
                .select('numero_cotizacion')
                .eq('sucu_id', sucu_id)
                .order('numero_cotizacion', { ascending: false })
                .limit(1)
                .single();

            let numeroCotizacion = 1;
            if (!errorNumero && ultimaCotizacion) {
                numeroCotizacion = (ultimaCotizacion.numero_cotizacion || 0) + 1;
            }

            const normalizarDecimal = (valor, decimales = 2) => {
                const numero = Number(valor);
                if (!Number.isFinite(numero)) return 0;
                return Number(numero.toFixed(decimales));
            };

            const productosNormalizados = (productos || []).map(producto => {
                const cantidad = Number(producto.cantidad) || 0;
                const precioUnitario = normalizarDecimal(producto.precio);
                const subtotalCalculado = normalizarDecimal(precioUnitario * cantidad);
                const subtotal = producto.subtotal !== undefined && producto.subtotal !== null
                    ? normalizarDecimal(producto.subtotal)
                    : subtotalCalculado;

                return {
                    ...producto,
                    cantidad,
                    precioNormalizado: precioUnitario,
                    subtotalNormalizado: subtotal
                };
            });

            const total = normalizarDecimal(
                productosNormalizados.reduce((sum, producto) => sum + producto.subtotalNormalizado, 0)
            );

            // Generar código de cotización
            const codigoCotizacion = generarCodigoCotizacion();

            // Iniciar transacción
            const insertData = {
                sucu_id,
                observaciones: observaciones || null,
                metodo_pago: metodo_pago || null,
                cliente_id: cliente_id || null,
                fecha: ahoraBolivia.toISOString(),
                estado: 'pendiente',
                total: total,
                numero_cotizacion: numeroCotizacion,
                fecha_vencimiento: fecha_vencimiento || null,
                agrupado: agrupado || false,
                precio_id: precio_id || null,
                codigo: codigoCotizacion,
                descuento: parseFloat(descuento) || 0,
                aumento: parseFloat(aumento) || 0,
                porcentaje: (() => {
                    const tieneDescuentoAumento = (parseFloat(descuento) || 0) > 0 || (parseFloat(aumento) || 0) > 0;
                    if (!tieneDescuentoAumento) return null;
                    return porcentaje === true ? true : (porcentaje === false ? false : null);
                })()
            };

            // Solo agregar campos que tienen valor
            if (user_id && user_id !== null) {
                insertData.user_id = user_id;
            }
            if (personal_id && personal_id !== null) {
                insertData.personal_id = personal_id;
            }

            // Insertar cotización
            const { data: cotizacion, error: cotizacionError } = await supabase
                .from('cotizaciones')
                .insert(insertData)
                .select('id, sucu_id, fecha, estado, total, numero_cotizacion, codigo, observaciones, metodo_pago, cliente_id, fecha_vencimiento, agrupado, precio_id')
                .single();

            if (cotizacionError) {
                console.error('Error creando cotización:', cotizacionError);
                return { success: false, message: 'Error al crear la cotización', error: cotizacionError };
            }

            // Crear los detalles de productos si existen
            if (productosNormalizados.length > 0) {
                // Preparar datos de productos con subtotal explícito
                const productosData = productosNormalizados.map(producto => ({
                    cotizacion_id: cotizacion.id,
                    producto_almacen_id: producto.id,
                    cantidad: producto.cantidad,
                    precio_unitario: producto.precioNormalizado,
                    subtotal: producto.subtotalNormalizado
                }));

                // Insertar todos los productos en una sola operación
                const { error: productosError } = await supabase
                    .from('cotizacion_detalle')
                    .insert(productosData)
                    .select('id');

                if (productosError) {
                    console.error('Error creando detalles de productos:', productosError);
                    // Limpiar la cotización si falla la inserción de productos
                    await this.cleanupCotizacion(cotizacion.id);
                    return { success: false, message: 'Error al crear los detalles de productos', error: productosError };
                }
            }

            return { 
                success: true, 
                data: {
                    ...cotizacion,
                    productos: productosNormalizados.map((producto) => ({
                        ...producto,
                        precio: producto.precioNormalizado,
                        subtotal: producto.subtotalNormalizado
                    }))
                }
            };

        } catch (error) {
            console.error('Error en Cotizaciones.create:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener una cotización por ID
    static async getById(cotizacionId) {
        try {
            const { data: cotizacion, error } = await supabase
                .from('cotizaciones')
                .select(COTIZACION_SELECT)
                .eq('id', cotizacionId)
                .single();

            if (error) {
                console.error('Error obteniendo cotización:', error);
                return { success: false, message: 'Error al obtener la cotización', error };
            }

            if (!cotizacion) {
                return { success: false, message: 'Cotización no encontrada' };
            }

            // Obtener productos de la cotización por separado
            const { data: productos, error: productosError } = await supabase
                .from('cotizacion_detalle')
                .select(`
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
                `)
                .eq('cotizacion_id', cotizacionId);

            if (productosError) {
                console.error('Error obteniendo productos de la cotización:', productosError);
                // Continuar sin productos en lugar de fallar
            }

            return {
                success: true,
                data: {
                    ...cotizacion,
                    productos: productos || []
                }
            };

        } catch (error) {
            console.error('Error en Cotizaciones.getById:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener todas las cotizaciones de una sucursal con paginación y filtros
    static async getAll(
        sucuId,
        page = 1,
        limit = 30,
        estado = null,
        ordenamiento = 'fecha_desc',
        search = null,
        clienteId = null,
        filtroFecha = null
    ) {
        try {
            const sanitizedPage = Math.max(parseInt(page, 10) || 1, 1);
            const sanitizedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
            const offset = (sanitizedPage - 1) * sanitizedLimit;
            const searchTerm = typeof search === 'string' ? search.trim() : '';

            let query = supabase
                .from('cotizaciones')
                .select(COTIZACION_SELECT, { count: 'estimated' })
                .eq('sucu_id', sucuId);

            if (estado) {
                query = query.eq('estado', estado);
            }

            if (clienteId) {
                query = query.eq('cliente_id', clienteId);
            }

            if (filtroFecha?.inicio) {
                query = query.gte('fecha', `${filtroFecha.inicio}T00:00:00.000Z`);
            }

            if (filtroFecha?.fin) {
                query = query.lte('fecha', `${filtroFecha.fin}T23:59:59.999Z`);
            }

            if (searchTerm) {
                const normalizedSearch = `%${searchTerm}%`;
                const orFilters = [];

                const numericValue = Number(searchTerm);
                if (!Number.isNaN(numericValue)) {
                    orFilters.push(`numero_cotizacion.eq.${numericValue}`);
                }

                orFilters.push(
                    `codigo.ilike.${normalizedSearch}`,
                    `observaciones.ilike.${normalizedSearch}`,
                    `metodo_pago.ilike.${normalizedSearch}`
                );

                const { data: clientesMatches, error: clientesError } = await supabase
                    .from('clients')
                    .select('id')
                    .ilike('name', normalizedSearch);

                if (!clientesError && clientesMatches?.length) {
                    const clienteIds = clientesMatches.map(cliente => cliente.id);
                    if (clienteIds.length > 0) {
                        orFilters.push(`cliente_id.in.(${clienteIds.join(',')})`);
                    }
                }

                const { data: productosMatches, error: productosError } = await supabase
                    .from('products_almacen')
                    .select('id')
                    .or(`name.ilike.${normalizedSearch},description.ilike.${normalizedSearch}`);

                if (!productosError && productosMatches?.length) {
                    const productIds = productosMatches.map(producto => producto.id);
                    if (productIds.length > 0) {
                        const { data: detalleMatches, error: detalleError } = await supabase
                            .from('cotizacion_detalle')
                            .select('cotizacion_id')
                            .in('producto_almacen_id', productIds);

                        if (!detalleError && detalleMatches?.length) {
                            const cotizacionIds = Array.from(new Set(detalleMatches.map(detalle => detalle.cotizacion_id)));
                            if (cotizacionIds.length > 0) {
                                orFilters.push(`id.in.(${cotizacionIds.join(',')})`);
                            }
                        }
                    }
                }

                if (orFilters.length > 0) {
                    query = query.or(orFilters.join(','));
                }
            }

            switch (ordenamiento) {
                case 'fecha_asc':
                    query = query.order('fecha', { ascending: true });
                    break;
                case 'numero_desc':
                    query = query.order('numero_cotizacion', { ascending: false });
                    break;
                case 'numero_asc':
                    query = query.order('numero_cotizacion', { ascending: true });
                    break;
                default:
                    query = query.order('fecha', { ascending: false });
                    break;
            }

            const { data, error, count } = await query.range(offset, offset + sanitizedLimit - 1);

            if (error) {
                console.error('Error obteniendo cotizaciones:', error);
                return { success: false, message: 'Error al obtener las cotizaciones', error };
            }

            // Si no hay cotizaciones, retornar array vacío
            if (!data || data.length === 0) {
                return {
                    success: true,
                    data: [],
                    pagination: {
                        total: count || 0,
                        page: sanitizedPage,
                        limit: sanitizedLimit,
                        hasNextPage: false
                    }
                };
            }

            // Hidratación OPTIMIZADA: cargar en lotes separados para evitar límite de 1000 líneas
            const cotizacionIds = data.map(c => c.id);
            const productosByCotizacion = new Map();
            (cotizacionIds || []).forEach(id => productosByCotizacion.set(id, []));

            // 1) Primero obtener productos de cotización SIN relaciones anidadas (para evitar límite de 1000)
            const batchSize = 50; // Reducir tamaño de lote para evitar límite
            const productosDetalleAll = [];

            for (let i = 0; i < cotizacionIds.length; i += batchSize) {
                const batchIds = cotizacionIds.slice(i, i + batchSize);

                // Obtener productos SIN relaciones anidadas primero
                const { data: productosBatch, error: productosError } = await supabase
                    .from('cotizacion_detalle')
                    .select(`
                        cotizacion_id,
                        id,
                        producto_almacen_id,
                        cantidad,
                        precio_unitario,
                        subtotal
                    `)
                    .in('cotizacion_id', batchIds);

                if (productosError) {
                    console.error(`[CotizacionesModel.getAll] Error obteniendo productos (lote ${Math.floor(i/batchSize) + 1}):`, productosError);
                    console.error(`[CotizacionesModel.getAll] Cotización IDs del lote:`, batchIds);
                } else if (productosBatch && Array.isArray(productosBatch)) {
                    productosDetalleAll.push(...productosBatch);
                }
            }

            // 2) Obtener IDs únicos de productos para cargar sus datos
            const productoIds = [...new Set(productosDetalleAll.map(p => p.producto_almacen_id))];

            // 3) Cargar productos de almacén en lotes pequeños para evitar límite de 1000
            const productosAlmacenMap = new Map();
            const productoBatchSize = 100; // Lotes de productos más pequeños

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
                    console.error(`[CotizacionesModel.getAll] Error obteniendo productos almacén (lote ${Math.floor(i/productoBatchSize) + 1}):`, productosAlmacenError);
                } else if (productosAlmacenBatch && Array.isArray(productosAlmacenBatch)) {
                    productosAlmacenBatch.forEach(prod => {
                        productosAlmacenMap.set(prod.id, prod);
                    });
                }
            }

            // 4) Combinar productos del detalle con sus datos de almacén
            productosDetalleAll.forEach(p => {
                if (p && p.cotizacion_id) {
                    const productoAlmacen = productosAlmacenMap.get(p.producto_almacen_id);
                    const productoCompleto = {
                        id: p.id,
                        cantidad: p.cantidad,
                        precio_unitario: p.precio_unitario,
                        subtotal: p.subtotal,
                        producto: productoAlmacen || null
                    };

                    const arr = productosByCotizacion.get(p.cotizacion_id) || [];
                    arr.push(productoCompleto);
                    productosByCotizacion.set(p.cotizacion_id, arr);
                }
            });

            // Armar respuesta final con productos incluidos
            const cotizacionesConProductos = data.map(cotizacion => ({
                ...cotizacion,
                productos: productosByCotizacion.get(cotizacion.id) || []
            }));

            const total = typeof count === 'number' ? count : cotizacionesConProductos?.length || 0;
            const hasNextPage = typeof count === 'number'
                ? count > offset + sanitizedLimit
                : (cotizacionesConProductos?.length || 0) === sanitizedLimit;

            return {
                success: true,
                data: cotizacionesConProductos || [],
                pagination: {
                    total,
                    page: sanitizedPage,
                    limit: sanitizedLimit,
                    hasNextPage
                }
            };

        } catch (error) {
            console.error('Error en Cotizaciones.getAll:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Actualizar estado de una cotización
    static async actualizarEstado(cotizacionId, nuevoEstado) {
        try {
            const estadosPermitidos = ['pendiente', 'aprobada', 'anulado', 'completado'];

            if (!estadosPermitidos.includes(nuevoEstado)) {
                return { success: false, message: 'Estado de cotización no válido' };
            }

            const { data: cotizacion, error } = await supabase
                .from('cotizaciones')
                .update({ estado: nuevoEstado })
                .eq('id', cotizacionId)
                .select(COTIZACION_SELECT)
                .single();

            if (error) {
                console.error('Error actualizando estado de cotización:', error);
                return { success: false, message: 'Error al actualizar el estado de la cotización', error };
            }

            return {
                success: true,
                data: cotizacion
            };

        } catch (error) {
            console.error('Error en Cotizaciones.actualizarEstado:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Eliminar una cotización
    static async eliminar(cotizacionId) {
        try {
            // Primero eliminar los detalles de la cotización
            const { error: detallesError } = await supabase
                .from('cotizacion_detalle')
                .delete()
                .eq('cotizacion_id', cotizacionId);

            if (detallesError) {
                console.error('Error eliminando detalles de cotización:', detallesError);
                return { success: false, message: 'Error al eliminar los detalles de la cotización', error: detallesError };
            }

            // Luego eliminar la cotización
            const { error: cotizacionError } = await supabase
                .from('cotizaciones')
                .delete()
                .eq('id', cotizacionId);

            if (cotizacionError) {
                console.error('Error eliminando cotización:', cotizacionError);
                return { success: false, message: 'Error al eliminar la cotización', error: cotizacionError };
            }

            return {
                success: true,
                data: { id: cotizacionId }
            };

        } catch (error) {
            console.error('Error en Cotizaciones.eliminar:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Método auxiliar para limpieza de cotizaciones
    static async cleanupCotizacion(cotizacionId) {
        try {
            // Eliminar detalles primero (FK constraint)
            await supabase
                .from('cotizacion_detalle')
                .delete()
                .eq('cotizacion_id', cotizacionId);
            
            // Eliminar cotización principal
            await supabase
                .from('cotizaciones')
                .delete()
                .eq('id', cotizacionId);
                
            console.log(`🧹 [CLEANUP] Cotización ${cotizacionId} eliminada correctamente`);
        } catch (error) {
            console.error('Error en limpieza de cotización:', error);
        }
    }
}

module.exports = cotizaciones;
