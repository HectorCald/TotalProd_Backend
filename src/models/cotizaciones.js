const { supabase } = require('../config/supabase');

const COTIZACION_SELECT = `
    id,
    numero_cotizacion,
    fecha,
    observaciones,
    metodo_pago,
    estado,
    total,
    fecha_vencimiento,
    agrupado,
    precio_id,
    user_id,
    personal_id,
    sucu_id,
    cliente_id,
    user:user_id(id, first_name, last_name),
    personal:personal_id(id, first_name, last_name),
    cliente:cliente_id(id, name),
    precio:precio_id(id, name),
    sucursales:sucu_id(id, name),
    productos:cotizacion_detalle(
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
`;

class cotizaciones {
    // Crear una nueva cotización
    static async create(cotizacionData) {
        try {
            const { user_id, personal_id, sucu_id, observaciones, metodo_pago, cliente_id, productos, fecha_vencimiento, agrupado, precio_id } = cotizacionData;

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
                precio_id: precio_id || null
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
                .select('id, sucu_id, fecha, estado, total, numero_cotizacion, observaciones, metodo_pago, cliente_id, fecha_vencimiento, agrupado, precio_id')
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

            return {
                success: true,
                data: cotizacion
            };

        } catch (error) {
            console.error('Error en Cotizaciones.getById:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener todas las cotizaciones de una sucursal
    static async getAll(sucuId, filtroFecha = null) {
        try {
            let query = supabase
                .from('cotizaciones')
                .select(COTIZACION_SELECT)
                .eq('sucu_id', sucuId)
                .order('fecha', { ascending: false });

            if (filtroFecha?.inicio) {
                query = query.gte('fecha', filtroFecha.inicio);
            }

            if (filtroFecha?.fin) {
                query = query.lte('fecha', filtroFecha.fin);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error obteniendo cotizaciones:', error);
                return { success: false, message: 'Error al obtener las cotizaciones', error };
            }

            return {
                success: true,
                data: data || []
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
