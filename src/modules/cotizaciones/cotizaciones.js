const { supabase } = require('../../config/supabase');
const { aplicarFiltroFecha } = require('../../utils/fechaRangeHelper');

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
    // Crear cotización
    static async create(cotizacionData) {
        try {
            const {
                user_id, personal_id, sucu_id,
                metodo_pago, cliente_id, precio_id,
                productos, fecha_vencimiento,
                agrupado, descuento, aumento, porcentaje, fecha, total
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
                fecha: (() => {
                    let d = new Date();
                    if (fecha) {
                        d = (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha))
                            ? new Date(fecha + 'T12:00:00Z')
                            : new Date(fecha);
                    }
                    if (isNaN(d.getTime())) d = new Date();
                    return d.toISOString();
                })(),
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
                })(),
                total: (total !== undefined && total !== null) ? normalizarDecimal(total) : 0
            };

            if (user_id) insertData.user_id = user_id;
            if (personal_id) insertData.personal_id = personal_id;

            // 1. Insertar cotización
            const { data: cotizacion, error: cotizacionError } = await supabase
                .from('cotizaciones')
                .insert(insertData)
                .select('id, numero_cotizacion, codigo, sucu_id, estado, fecha, metodo_pago, cliente_id, precio_id, agrupado, fecha_vencimiento, descuento, aumento, porcentaje, total')
                .single();

            if (cotizacionError) {
                console.error('Error en create - insertar cotización:', cotizacionError);
                return { success: false, message: 'Error al crear la cotización', error: cotizacionError };
            }

            // 2. Insertar detalles
            if (productosNormalizados.length > 0) {
                const productosData = productosNormalizados.map(producto => ({
                    cotizacion_id: cotizacion.id,
                    producto_almacen_id: producto.id,
                    cantidad: producto.cantidad,
                    precio_unitario: producto.precioNormalizado
                }));

                const { error: productosError } = await supabase
                    .from('cotizacion_detalle')
                    .insert(productosData)
                    .select('id');

                if (productosError) {
                    console.error('Error en create - insertar detalle:', productosError);
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
            console.error('Error en Cotizaciones.create:', error);
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

            query = aplicarFiltroFecha(query, 'fecha', filtroFecha);

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

            const cotizacionesMapeadas = data.map(cotizacion => ({
                ...cotizacion,
                total: (cotizacion.total !== undefined && cotizacion.total !== null) ? (parseFloat(cotizacion.total) || 0) : 0
            }));

            const total = typeof count === 'number' ? count : cotizacionesMapeadas?.length || 0;
            const hasNextPage = typeof count === 'number'
                ? count > offset + sanitizedLimit
                : (cotizacionesMapeadas?.length || 0) === sanitizedLimit;

            return {
                success: true,
                data: cotizacionesMapeadas,
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

    // Obtener productos de una cotización de forma separada
    static async getProductos(cotizacionId) {
        try {
            const { data: productos, error } = await supabase
                .from('cotizacion_detalle')
                .select(`
                    id,
                    cantidad,
                    precio_unitario,
                    producto:producto_almacen_id(
                        id,
                        name,
                        description,
                        grup
                    )
                `)
                .eq('cotizacion_id', cotizacionId);

            if (error) {
                console.error('Error obteniendo productos de cotización:', error);
                return { success: false, message: 'Error al obtener productos de la cotización', error };
            }

            return {
                success: true,
                data: productos || []
            };
        } catch (error) {
            console.error('Error en Cotizaciones.getProductos:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Eliminar una cotización
    static async delete(cotizacionId) {
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
            console.error('Error en Cotizaciones.delete:', error);
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