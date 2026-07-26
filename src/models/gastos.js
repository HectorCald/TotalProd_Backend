const { supabase } = require('../config/supabase');

class gastos {
    // Crear un nuevo gasto
    static async create(gastoData) {
        try {
            const { user_id, personal_id, sucu_id, branch_id, fecha_gasto, valor, concepto, metodo_pago, proveedor_id, movimiento_entrada_id, movimiento_acopio_entrada_id } = gastoData;
            const targetBranchId = branch_id || sucu_id;

            // Usar la fecha proporcionada directamente (formato YYYY-MM-DD)
            let fechaFinal;
            if (fecha_gasto) {
                // Si es solo fecha (YYYY-MM-DD), agregar T12:00:00 para evitar desfase de zona horaria
                fechaFinal = (typeof fecha_gasto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_gasto))
                    ? fecha_gasto + 'T12:00:00'
                    : fecha_gasto;
            } else {
                // Si no viene fecha, usar la actual
                fechaFinal = new Date().toISOString();
            }

            const dbData = {
                fecha_gasto: fechaFinal,
                valor,
                concepto,
                metodo_pago,
                proveedor_id: proveedor_id || null,
                movimiento_entrada_id: movimiento_entrada_id || null,
                movimiento_acopio_entrada_id: movimiento_acopio_entrada_id || null
            };

            // Solo agregar user_id o personal_id si tienen valor
            if (user_id && user_id !== null) {
                dbData.user_id = user_id;
            }
            if (personal_id && personal_id !== null) {
                dbData.personal_id = personal_id;
            }
            if (targetBranchId && targetBranchId !== null) {
                dbData.sucu_id = targetBranchId;
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
    static normalizeSearchTokens(search = '') {
        if (!search) return [];
        const normalized = search
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[-_/]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!normalized) return [];

        const tokens = new Set();
        normalized.split(' ').forEach(token => {
            const cleanToken = token.replace(/'/g, '');
            if (cleanToken) tokens.add(cleanToken);
        });

        return Array.from(tokens);
    }

    // Obtener todos los gastos sin límite
    static async getAllSinLimite(sucuId, metodoPago = null, filtroFecha = null) {
        try {
            if (!sucuId) return { success: false, message: 'No hay sucursal seleccionada' };
            let query = supabase.from('gastos').select('id, valor, metodo_pago, fecha_gasto').eq('sucu_id', sucuId);

            if (metodoPago) query = query.eq('metodo_pago', metodoPago);
            if (filtroFecha) {
                if (filtroFecha.inicio) query = query.gte('fecha_gasto', `${filtroFecha.inicio}T00:00:00.000-04:00`);
                if (filtroFecha.fin) query = query.lte('fecha_gasto', `${filtroFecha.fin}T23:59:59.999-04:00`);
            }

            const { data, error } = await query;
            if (error) throw new Error('Error al obtener los gastos sin límite');

            return { success: true, data };
        } catch (error) {
            console.error('Error en gastos.getAllSinLimite:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    static async getAll(page = 1, limit = 30, search = '', metodoPago = null, proveedorId = null, ordenamiento = 'fecha_desc', sucuIdParam = null, filtroFecha = null) {
        try {
            const sucuId = sucuIdParam;
            if (!sucuId) {
                return {
                    success: false,
                    message: 'No hay sucursal seleccionada'
                };
            }

            const currentPage = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
            const perPage = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 30;
            const offset = (currentPage - 1) * perPage;

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
                    )
                `, { count: 'estimated' })
                .eq('sucu_id', sucuId);

            // Aplicar búsqueda si se proporciona
            const searchTokens = gastos.normalizeSearchTokens(search);
            if (searchTokens.length > 0) {
                const orFilters = searchTokens.flatMap(token => ([
                    `concepto.ilike.%${token}%`,
                    `metodo_pago.ilike.%${token}%`
                ]));
                query = query.or(orFilters.join(','));
            }

            // Aplicar filtro de método de pago
            if (metodoPago) {
                query = query.eq('metodo_pago', metodoPago);
            }

            // Aplicar filtro de proveedor
            if (proveedorId) {
                query = query.eq('proveedor_id', proveedorId);
            }

            // Aplicar filtro de fecha si se proporciona (incluyendo el día completo en zona horaria local -04:00)
            if (filtroFecha) {
                if (filtroFecha.inicio) {
                    query = query.gte('fecha_gasto', `${filtroFecha.inicio}T00:00:00.000-04:00`);
                }
                if (filtroFecha.fin) {
                    query = query.lte('fecha_gasto', `${filtroFecha.fin}T23:59:59.999-04:00`);
                }
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
            query = query.range(offset, offset + perPage - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('Error al obtener gastos:', error);
                throw new Error('Error al obtener los gastos');
            }

            // Obtener ids de gastos para buscar en pedidos_acopio
            const gastoIds = (data || []).map(g => g.id);
            let pedidosAcopioMap = new Map();
            if (gastoIds.length > 0) {
                const { data: pedidosAsociados } = await supabase
                    .from('pedidos_acopio')
                    .select('id, gasto_id, gasto_otros_id')
                    .or(`gasto_id.in.(${gastoIds.join(',')}),gasto_otros_id.in.(${gastoIds.join(',')})`);
                
                if (pedidosAsociados) {
                    pedidosAsociados.forEach(p => {
                        if (p.gasto_id) pedidosAcopioMap.set(p.gasto_id, p.id);
                        if (p.gasto_otros_id) pedidosAcopioMap.set(p.gasto_otros_id, p.id);
                    });
                }
            }

            // Procesar los datos para agregar el campo name a user y personal
            const processedData = (data || []).map(gasto => {
                const processedGasto = { 
                    ...gasto,
                    pedido_acopio_id: pedidosAcopioMap.get(gasto.id) || null
                };
                
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

            const totalItems = count || 0;
            const totalPages = perPage > 0 ? Math.ceil(totalItems / perPage) : 0;
            const hasNextPage = currentPage < totalPages;
            const hasPreviousPage = currentPage > 1 && totalPages > 0;

            return {
                success: true,
                data: processedData,
                pagination: {
                    currentPage,
                    totalPages,
                    totalItems,
                    itemsPerPage: perPage,
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

            // Si viene una fecha específica, agregar T12:00:00 para evitar desfase de zona horaria
            if (fecha_gasto) {
                dbData.fecha_gasto = (typeof fecha_gasto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_gasto))
                    ? fecha_gasto + 'T12:00:00'
                    : fecha_gasto;
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
                .order('fecha_gasto', { ascending: true });

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
            // Revisar si el gasto mismo tiene las FKs
            const { data: gastoSelf, error: gastoError } = await supabase
                .from('gastos')
                .select('movimiento_entrada_id, movimiento_acopio_entrada_id')
                .eq('id', gastoId)
                .single();
                
            if (gastoSelf && (gastoSelf.movimiento_entrada_id || gastoSelf.movimiento_acopio_entrada_id)) {
                return true;
            }

            // Revisar asociación con movimientos de acopio (si el movimiento apunta al gasto)
            const { data: acopioData, error: acopioError } = await supabase
                .from('movimientos_acopio')
                .select('id')
                .eq('gasto_id', gastoId)
                .limit(1);

            if (acopioError) {
                console.error('Error verificando asociación de gasto (acopio):', acopioError);
            }

            if (acopioData && acopioData.length > 0) return true;

            // Revisar asociación con movimientos de almacén (si el movimiento apunta al gasto)
            const { data: almacenData, error: almacenError } = await supabase
                .from('movimientos_almacen')
                .select('id')
                .eq('gasto_id', gastoId)
                .limit(1);

            if (almacenError) {
                console.error('Error verificando asociación de gasto (almacén):', almacenError);
            }

            // Revisar asociación con pedidos_acopio (si el pedido de acopio apunta al gasto)
            const { data: pedidosAcopioData, error: pedidosAcopioError } = await supabase
                .from('pedidos_acopio')
                .select('id')
                .or(`gasto_id.eq.${gastoId},gasto_otros_id.eq.${gastoId}`)
                .limit(1);

            if (pedidosAcopioError) {
                console.error('Error verificando asociación de gasto (pedidos_acopio):', pedidosAcopioError);
            }

            if (pedidosAcopioData && pedidosAcopioData.length > 0) return true;

            return !!(almacenData && almacenData.length > 0);
        } catch (error) {
            console.error('Error en isAssociatedWithMovement:', error);
            return false;
        }
    }
}

module.exports = gastos;
