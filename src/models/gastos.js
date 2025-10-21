const { supabase } = require('../config/supabase');

class gastos {
    // Crear un nuevo gasto
    static async create(gastoData) {
        try {
            const { user_id, personal_id, sucu_id, fecha_gasto, valor, concepto, metodo_pago, proveedor_id } = gastoData;

            // Usar la fecha proporcionada directamente (formato YYYY-MM-DD)
            let fechaFinal;
            if (fecha_gasto) {
                // Si viene una fecha específica, usarla directamente
                fechaFinal = fecha_gasto;
            } else {
                // Si no viene fecha, usar la actual en formato YYYY-MM-DD en zona horaria de Bolivia
                const ahora = new Date();
                const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));
                const año = ahoraBolivia.getFullYear();
                const mes = String(ahoraBolivia.getMonth() + 1).padStart(2, '0');
                const dia = String(ahoraBolivia.getDate()).padStart(2, '0');
                fechaFinal = `${año}-${mes}-${dia}`;
            }

            const dbData = {
                fecha_gasto: fechaFinal,
                valor,
                concepto,
                metodo_pago,
                proveedor_id: proveedor_id || null
            };

            // Solo agregar user_id o personal_id si tienen valor
            if (user_id && user_id !== null) {
                dbData.user_id = user_id;
            }
            if (personal_id && personal_id !== null) {
                dbData.personal_id = personal_id;
            }
            if (sucu_id && sucu_id !== null) {
                dbData.sucu_id = sucu_id;
            }

            const { data, error } = await supabase
                .from('gastos')
                .insert([dbData])
                .select(`
                    *,
                    proveedor:proveedor_id (
                        id,
                        name
                    )
                `)
                .single();

            if (error) {
                console.error('Error al crear gasto:', error);
                throw new Error('Error al crear el gasto');
            }

            return {
                success: true,
                data: data,
                message: 'Gasto creado correctamente'
            };

        } catch (error) {
            console.error('Error en create gasto:', error);
            return {
                success: false,
                message: error.message || 'Error al crear el gasto'
            };
        }
    }

    // Obtener todos los gastos con paginación y filtros
    static async getAll(page = 1, limit = 10, search = '', metodoPago = null, proveedorId = null, ordenamiento = 'fecha_desc', sucuIdParam = null) {
        try {
            const sucuId = sucuIdParam;
            if (!sucuId) {
                return {
                    success: false,
                    message: 'No hay sucursal seleccionada'
                };
            }

            const offset = (page - 1) * limit;

            let query = supabase
                .from('gastos')
                .select(`
                    *,
                    proveedor:proveedor_id (
                        id,
                        name
                    ),
                    user:user_id (
                        id,
                        first_name,
                        last_name
                    ),
                    personal:personal_id (
                        id,
                        first_name,
                        last_name
                    ),
                    sucursal:sucu_id (
                        id,
                        name
                    )
                `, { count: 'exact' })
                .eq('sucu_id', sucuId);

            // Aplicar búsqueda si se proporciona
            if (search && search.trim() !== '') {
                query = query.or(`concepto.ilike.%${search}%,metodo_pago.ilike.%${search}%`);
            }

            // Aplicar filtro de método de pago
            if (metodoPago) {
                query = query.eq('metodo_pago', metodoPago);
            }

            // Aplicar filtro de proveedor
            if (proveedorId) {
                query = query.eq('proveedor_id', proveedorId);
            }

            // Aplicar ordenamiento
            switch (ordenamiento) {
                case 'fecha_desc':
                    query = query.order('fecha_gasto', { ascending: false });
                    break;
                case 'fecha_asc':
                    query = query.order('fecha_gasto', { ascending: true });
                    break;
                case 'valor_desc':
                    query = query.order('valor', { ascending: false });
                    break;
                case 'valor_asc':
                    query = query.order('valor', { ascending: true });
                    break;
                case 'concepto_asc':
                    query = query.order('concepto', { ascending: true });
                    break;
                case 'concepto_desc':
                    query = query.order('concepto', { ascending: false });
                    break;
                default:
                    query = query.order('fecha_gasto', { ascending: false });
            }

            // Aplicar paginación
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('Error al obtener gastos:', error);
                throw new Error('Error al obtener los gastos');
            }

            // Procesar los datos para agregar el campo name a user y personal
            const processedData = (data || []).map(gasto => {
                const processedGasto = { ...gasto };
                
                // Procesar user
                if (gasto.user) {
                    processedGasto.user = {
                        ...gasto.user,
                        name: `${gasto.user.first_name} ${gasto.user.last_name}`.trim()
                    };
                }
                
                // Procesar personal
                if (gasto.personal) {
                    processedGasto.personal = {
                        ...gasto.personal,
                        name: `${gasto.personal.first_name} ${gasto.personal.last_name}`.trim()
                    };
                }
                
                return processedGasto;
            });

            const totalPages = Math.ceil(count / limit);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;

            return {
                success: true,
                data: processedData,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems: count,
                    itemsPerPage: limit,
                    hasNextPage,
                    hasPreviousPage
                }
            };

        } catch (error) {
            console.error('Error en getAll gastos:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener los gastos'
            };
        }
    }

    // Obtener todos los gastos sin límite (para reportes)
    static async getAllSinLimite(ordenamiento = 'fecha_gasto_desc', sucuIdParam = null) {
        try {
            const sucuId = sucuIdParam;
            if (!sucuId) {
                return {
                    success: false,
                    message: 'No hay sucursal seleccionada'
                };
            }

            let query = supabase
                .from('gastos')
                .select(`
                    *,
                    proveedor:proveedor_id (
                        id,
                        name
                    ),
                    user:user_id (
                        id,
                        first_name,
                        last_name
                    ),
                    personal:personal_id (
                        id,
                        first_name,
                        last_name
                    ),
                    sucursal:sucu_id (
                        id,
                        name
                    )
                `)
                .eq('sucu_id', sucuId);

            // Aplicar ordenamiento
            switch (ordenamiento) {
                case 'fecha_gasto_desc':
                    query = query.order('fecha_gasto', { ascending: false });
                    break;
                case 'fecha_gasto_asc':
                    query = query.order('fecha_gasto', { ascending: true });
                    break;
                case 'valor_desc':
                    query = query.order('valor', { ascending: false });
                    break;
                case 'valor_asc':
                    query = query.order('valor', { ascending: true });
                    break;
                case 'concepto_asc':
                    query = query.order('concepto', { ascending: true });
                    break;
                case 'concepto_desc':
                    query = query.order('concepto', { ascending: false });
                    break;
                default:
                    query = query.order('fecha_gasto', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error al obtener gastos sin límite:', error);
                throw new Error('Error al obtener los gastos');
            }

            // Procesar los datos para agregar el campo name a user y personal
            const processedData = (data || []).map(gasto => {
                const processedGasto = { ...gasto };
                
                // Procesar user
                if (gasto.user) {
                    processedGasto.user = {
                        ...gasto.user,
                        name: `${gasto.user.first_name} ${gasto.user.last_name}`.trim()
                    };
                }
                
                // Procesar personal
                if (gasto.personal) {
                    processedGasto.personal = {
                        ...gasto.personal,
                        name: `${gasto.personal.first_name} ${gasto.personal.last_name}`.trim()
                    };
                }
                
                return processedGasto;
            });

            return {
                success: true,
                data: processedData
            };

        } catch (error) {
            console.error('Error en getAllSinLimite gastos:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener los gastos'
            };
        }
    }

    // Obtener un gasto por ID
    static async getById(id) {
        try {
            const { data, error } = await supabase
                .from('gastos')
                .select(`
                    *,
                    proveedor:proveedor_id (
                        id,
                        name
                    ),
                    user:user_id (
                        id,
                        first_name,
                        last_name
                    ),
                    personal:personal_id (
                        id,
                        first_name,
                        last_name
                    ),
                    sucursal:sucu_id (
                        id,
                        name
                    )
                `)
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error al obtener gasto por ID:', error);
                throw new Error('Error al obtener el gasto');
            }

            // Procesar los datos para agregar el campo name a user y personal
            let processedData = { ...data };
            
            // Procesar user
            if (data.user) {
                processedData.user = {
                    ...data.user,
                    name: `${data.user.first_name} ${data.user.last_name}`.trim()
                };
            }
            
            // Procesar personal
            if (data.personal) {
                processedData.personal = {
                    ...data.personal,
                    name: `${data.personal.first_name} ${data.personal.last_name}`.trim()
                };
            }

            return {
                success: true,
                data: processedData
            };

        } catch (error) {
            console.error('Error en getById gasto:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener el gasto'
            };
        }
    }

    // Actualizar un gasto
    static async update(id, updateData) {
        try {
            const { fecha_gasto, valor, concepto, metodo_pago, proveedor_id } = updateData;

            const dbData = {
                valor,
                concepto,
                metodo_pago,
                proveedor_id: proveedor_id || null
            };

            // Si viene una fecha específica, convertirla a zona horaria de Bolivia
            if (fecha_gasto) {
                const fechaOriginal = new Date(fecha_gasto);
                const fechaGastoBolivia = new Date(fechaOriginal.toLocaleString("en-US", {timeZone: "America/La_Paz"}));
                dbData.fecha_gasto = fechaGastoBolivia.toISOString();
            }

            const { data, error } = await supabase
                .from('gastos')
                .update(dbData)
                .eq('id', id)
                .select(`
                    *,
                    proveedor:proveedor_id (
                        id,
                        name
                    )
                `)
                .single();

            if (error) {
                console.error('Error al actualizar gasto:', error);
                throw new Error('Error al actualizar el gasto');
            }

            return {
                success: true,
                data: data,
                message: 'Gasto actualizado correctamente'
            };

        } catch (error) {
            console.error('Error en update gasto:', error);
            return {
                success: false,
                message: error.message || 'Error al actualizar el gasto'
            };
        }
    }

    // Eliminar un gasto
    static async delete(id) {
        try {
            const { error } = await supabase
                .from('gastos')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error al eliminar gasto:', error);
                // Manejo específico de errores de llave foránea (asociado a movimiento)
                const rawMsg = (error.message || '').toLowerCase();
                if (error.code === '23503' || rawMsg.includes('foreign key') || rawMsg.includes('referential integrity')) {
                    return {
                        success: false,
                        message: 'No se puede eliminar este gasto porque está asociado a un movimiento. Anule/elimine el movimiento primero.'
                    };
                }
                return {
                    success: false,
                    message: error.message || 'Error al eliminar el gasto'
                };
            }

            return {
                success: true,
                message: 'Gasto eliminado correctamente'
            };

        } catch (error) {
            console.error('Error en delete gasto:', error);
            return {
                success: false,
                message: error.message || 'Error al eliminar el gasto'
            };
        }
    }

    // Obtener gastos por rango de fechas
    static async getByDateRange(fechaInicio, fechaFin, sucuId) {
        try {
            if (!sucuId) {
                return {
                    success: false,
                    message: 'No hay sucursal seleccionada'
                };
            }

            const { data, error } = await supabase
                .from('gastos')
                .select(`
                    *,
                    proveedor:proveedor_id (
                        id,
                        name
                    )
                `)
                .eq('sucu_id', sucuId)
                .gte('fecha_gasto', fechaInicio)
                .lte('fecha_gasto', fechaFin)
                .order('fecha_gasto', { ascending: false });

            if (error) {
                console.error('Error al obtener gastos por rango de fechas:', error);
                throw new Error('Error al obtener los gastos');
            }

            return {
                success: true,
                data: data || []
            };

        } catch (error) {
            console.error('Error en getByDateRange gastos:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener los gastos'
            };
        }
    }

    // Verificar si un gasto está asociado a algún movimiento
    static async isAssociatedWithMovement(gastoId) {
        try {
            // Revisar asociación con movimientos de acopio
            const { data: acopioData, error: acopioError } = await supabase
                .from('movimientos_acopio')
                .select('id')
                .eq('gasto_id', gastoId)
                .limit(1);

            if (acopioError) {
                console.error('Error verificando asociación de gasto (acopio):', acopioError);
            }

            if (acopioData && acopioData.length > 0) return true;

            // Revisar asociación con movimientos de almacén
            const { data: almacenData, error: almacenError } = await supabase
                .from('movimientos_almacen')
                .select('id')
                .eq('gasto_id', gastoId)
                .limit(1);

            if (almacenError) {
                console.error('Error verificando asociación de gasto (almacén):', almacenError);
            }

            return !!(almacenData && almacenData.length > 0);
        } catch (error) {
            console.error('Error en isAssociatedWithMovement:', error);
            return false;
        }
    }
}

module.exports = gastos;
