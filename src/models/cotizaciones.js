const { supabase } = require('../config/supabase');

class cotizaciones {
    // Crear una nueva cotización
    static async create(cotizacionData) {
        try {
            const { user_id, personal_id, sucu_id, observaciones, metodo_pago, cliente_id, productos, fecha_vencimiento, agrupado, precio_id } = cotizacionData;

            // Crear timestamp en zona horaria de Bolivia (GMT-4)
            const ahora = new Date();
            const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));

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

            // Calcular el total de la cotización
            const total = productos.reduce((sum, producto) => {
                return sum + (producto.cantidad * producto.precio);
            }, 0);

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
            if (productos && productos.length > 0) {
                // Preparar datos de productos
                const productosData = productos.map(producto => {
                    const precio = Number(producto.precio) || 0;
                    const cantidad = Number(producto.cantidad);
                    return {
                        cotizacion_id: cotizacion.id,
                        producto_almacen_id: producto.id,
                        cantidad: cantidad,
                        precio_unitario: precio
                        // subtotal se calcula automáticamente por la columna generada
                    };
                });

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
                    productos: productos || []
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
                .select(`
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
                `)
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

    // Obtener todas las cotizaciones
    static async getAll() {
        try {
            const { data: cotizaciones, error } = await supabase
                .from('cotizaciones')
                .select(`
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
                `)
                .order('fecha', { ascending: false });

            if (error) {
                console.error('Error obteniendo cotizaciones:', error);
                return { success: false, message: 'Error al obtener las cotizaciones', error };
            }

            return {
                success: true,
                data: cotizaciones || []
            };

        } catch (error) {
            console.error('Error en Cotizaciones.getAll:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Anular una cotización
    static async anular(cotizacionId) {
        try {
            const { data: cotizacion, error } = await supabase
                .from('cotizaciones')
                .update({ estado: 'anulado' })
                .eq('id', cotizacionId)
                .select(`
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
                `)
                .single();

            if (error) {
                console.error('Error anulando cotización:', error);
                return { success: false, message: 'Error al anular la cotización', error };
            }

            return {
                success: true,
                data: cotizacion
            };

        } catch (error) {
            console.error('Error en Cotizaciones.anular:', error);
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
