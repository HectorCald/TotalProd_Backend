const { supabase } = require('../config/supabase');

const formatDateInput = (value, { keepTime = false } = {}) => {
    if (!value) return null;

    if (value instanceof Date) {
        return keepTime ? value.toISOString() : value.toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
        // Para dates sin tiempo (YYYY-MM-DD)
        if (!keepTime && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }

        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
            return keepTime ? parsed.toISOString() : parsed.toISOString().split('T')[0];
        }
    }

    return null;
};

class deudas {
    // Crear una nueva deuda
    static async create(deudaData) {
        try {
            const { user_id, personal_id, sucu_id, fecha_deuda, fecha_vencimiento, monto_total, concepto, cliente_id, movimiento_salida_id, destino_sucursal_id } = deudaData;

            // Usar la fecha proporcionada directamente (formato YYYY-MM-DD)
            let fechaDeudaFinal;
            const fechaDeudaNormalizada = formatDateInput(fecha_deuda);

            if (fechaDeudaNormalizada) {
                fechaDeudaFinal = fechaDeudaNormalizada;
            } else {
                // Si no viene fecha, usar la actual en formato YYYY-MM-DD
                const ahora = new Date();
                const año = ahora.getFullYear();
                const mes = String(ahora.getMonth() + 1).padStart(2, '0');
                const dia = String(ahora.getDate()).padStart(2, '0');
                fechaDeudaFinal = `${año}-${mes}-${dia}`;
            }

            const fechaVencimientoFinal = formatDateInput(fecha_vencimiento);
            if (fecha_vencimiento && !fechaVencimientoFinal) {
                throw new Error('Fecha de vencimiento inválida');
            }

            const dbData = {
                fecha_deuda: fechaDeudaFinal,
                fecha_vencimiento: fechaVencimientoFinal || null,
                monto_total,
                saldo_pendiente: monto_total, // Inicialmente el saldo pendiente es igual al monto total
                concepto,
                estado: 'pendiente',
                cliente_id: cliente_id || null,
                movimiento_salida_id: movimiento_salida_id || null,
                destino_sucursal_id: destino_sucursal_id || null
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
                .from('deudas')
                .insert([dbData])
                .select(`
                    *,
                    cliente:cliente_id (
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
                `)
                .single();

            if (error) {
                console.error('Error al crear deuda:', error);
                throw new Error('Error al crear la deuda');
            }

            // Procesar nombres de user/personal si existen
            const processed = { ...data };
            if (data?.user) {
                processed.user = {
                    ...data.user,
                    name: `${data.user.first_name} ${data.user.last_name}`.trim()
                };
            }
            if (data?.personal) {
                processed.personal = {
                    ...data.personal,
                    name: `${data.personal.first_name} ${data.personal.last_name}`.trim()
                };
            }

            return {
                success: true,
                data: processed,
                message: 'Deuda creada correctamente'
            };

        } catch (error) {
            console.error('Error en create deuda:', error);
            return {
                success: false,
                message: error.message || 'Error al crear la deuda'
            };
        }
    }

    // Obtener todas las deudas con paginación y filtros
    static async getAll(page = 1, limit = 10, search = '', estado = null, clienteId = null, ordenamiento = 'fecha_desc', sucuIdParam = null, filtroFecha = null) {
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
                .from('deudas')
                .select(`
                    *,
                    cliente:cliente_id (
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
                    ),
                    sucursal_destino:destino_sucursal_id (
                        id,
                        name
                    )
                `, { count: 'exact' })
                .eq('sucu_id', sucuId);

            // Aplicar búsqueda si se proporciona
            if (search && search.trim() !== '') {
                query = query.or(`concepto.ilike.%${search}%,estado.ilike.%${search}%`);
            }

            // Aplicar filtro de estado
            if (estado) {
                query = query.eq('estado', estado);
            }

            // Aplicar filtro de cliente
            if (clienteId) {
                query = query.eq('cliente_id', clienteId);
            }

            // Aplicar filtro de fecha si se proporciona
            if (filtroFecha) {
                if (filtroFecha.inicio) {
                    query = query.gte('fecha_deuda', filtroFecha.inicio);
                }
                if (filtroFecha.fin) {
                    query = query.lte('fecha_deuda', filtroFecha.fin);
                }
            }

            // Aplicar ordenamiento
            switch (ordenamiento) {
                case 'fecha_desc':
                    query = query.order('fecha_deuda', { ascending: false });
                    break;
                case 'fecha_asc':
                    query = query.order('fecha_deuda', { ascending: true });
                    break;
                case 'vencimiento_desc':
                    query = query.order('fecha_vencimiento', { ascending: false });
                    break;
                case 'vencimiento_asc':
                    query = query.order('fecha_vencimiento', { ascending: true });
                    break;
                case 'monto_desc':
                    query = query.order('monto_total', { ascending: false });
                    break;
                case 'monto_asc':
                    query = query.order('monto_total', { ascending: true });
                    break;
                case 'concepto_asc':
                    query = query.order('concepto', { ascending: true });
                    break;
                case 'concepto_desc':
                    query = query.order('concepto', { ascending: false });
                    break;
                default:
                    query = query.order('fecha_deuda', { ascending: false });
            }

            // Aplicar paginación
            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('Error al obtener deudas:', error);
                throw new Error('Error al obtener las deudas');
            }

            // Procesar los datos para agregar el campo name a user y personal
            const processedData = (data || []).map(deuda => {
                const processedDeuda = { ...deuda };
                
                // Procesar user
                if (deuda.user) {
                    processedDeuda.user = {
                        ...deuda.user,
                        name: `${deuda.user.first_name} ${deuda.user.last_name}`.trim()
                    };
                }
                
                // Procesar personal
                if (deuda.personal) {
                    processedDeuda.personal = {
                        ...deuda.personal,
                        name: `${deuda.personal.first_name} ${deuda.personal.last_name}`.trim()
                    };
                }
                
                return processedDeuda;
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
            console.error('Error en getAll deudas:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener las deudas'
            };
        }
    }


    // Obtener una deuda por ID
    static async getById(id) {
        try {
            const { data, error } = await supabase
                .from('deudas')
                .select(`
                    *,
                    cliente:cliente_id (
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
                    ),
                    sucursal_destino:destino_sucursal_id (
                        id,
                        name
                    )
                `)
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error al obtener deuda por ID:', error);
                throw new Error('Error al obtener la deuda');
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
            console.error('Error en getById deuda:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener la deuda'
            };
        }
    }

    // Actualizar una deuda
    static async update(id, updateData) {
        try {
            const { fecha_deuda, fecha_vencimiento, monto_total, saldo_pendiente, concepto, estado, cliente_id } = updateData;

            const dbData = {};

            if (concepto !== undefined) {
                dbData.concepto = concepto;
            }

            if (cliente_id !== undefined) {
                dbData.cliente_id = cliente_id || null;
            }

            // No aplicar conversiones de zona horaria: persistir tal cual viene (YYYY-MM-DD para columnas DATE)
            if (fecha_deuda) {
                const fechaNormalizada = formatDateInput(fecha_deuda);
                if (fechaNormalizada) {
                    dbData.fecha_deuda = fechaNormalizada;
                }
            }

            if (fecha_vencimiento) {
                const vencimientoNormalizado = formatDateInput(fecha_vencimiento);
                if (!vencimientoNormalizado) {
                    throw new Error('Fecha de vencimiento inválida');
                }
                if (vencimientoNormalizado) {
                    dbData.fecha_vencimiento = vencimientoNormalizado;
                }
            }

            if (monto_total !== undefined) {
                dbData.monto_total = monto_total;
                if (saldo_pendiente === undefined) {
                    dbData.saldo_pendiente = monto_total;
                }
            }

            if (saldo_pendiente !== undefined) {
                dbData.saldo_pendiente = saldo_pendiente;
            }

            if (estado) {
                dbData.estado = estado;
            }

            const { data, error } = await supabase
                .from('deudas')
                .update(dbData)
                .eq('id', id)
                .select(`
                    *,
                    cliente:cliente_id (
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
                    sucursal_destino:destino_sucursal_id (
                        id,
                        name
                    )
                `)
                .single();

            if (error) {
                console.error('Error al actualizar deuda:', error);
                throw new Error('Error al actualizar la deuda');
            }

            // Procesar nombres de user/personal si existen
            const processed = { ...data };
            if (data?.user) {
                processed.user = {
                    ...data.user,
                    name: `${data.user.first_name} ${data.user.last_name}`.trim()
                };
            }
            if (data?.personal) {
                processed.personal = {
                    ...data.personal,
                    name: `${data.personal.first_name} ${data.personal.last_name}`.trim()
                };
            }

            return {
                success: true,
                data: processed,
                message: 'Deuda actualizada correctamente'
            };

        } catch (error) {
            console.error('Error en update deuda:', error);
            return {
                success: false,
                message: error.message || 'Error al actualizar la deuda'
            };
        }
    }

    // Eliminar una deuda
    static async delete(id) {
        try {
            const { error } = await supabase
                .from('deudas')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error al eliminar deuda:', error);
                throw new Error('Error al eliminar la deuda');
            }

            return {
                success: true,
                message: 'Deuda eliminada correctamente'
            };

        } catch (error) {
            console.error('Error en delete deuda:', error);
            return {
                success: false,
                message: error.message || 'Error al eliminar la deuda'
            };
        }
    }

    // Eliminar deudas por movimiento_salida_id
    static async deleteByMovimientoSalidaId(movimientoSalidaId) {
        try {
            const { error } = await supabase
                .from('deudas')
                .delete()
                .eq('movimiento_salida_id', movimientoSalidaId);

            if (error) {
                console.error('Error al eliminar deudas por movimiento_salida_id:', error);
                throw new Error('Error al eliminar las deudas asociadas al movimiento');
            }

            return {
                success: true,
                message: 'Deudas asociadas al movimiento eliminadas correctamente'
            };

        } catch (error) {
            console.error('Error en deleteByMovimientoSalidaId:', error);
            return {
                success: false,
                message: error.message || 'Error al eliminar las deudas asociadas al movimiento'
            };
        }
    }

    // Obtener deudas por rango de fechas
    static async getByDateRange(fechaInicio, fechaFin, sucuId) {
        try {
            if (!sucuId) {
                return {
                    success: false,
                    message: 'No hay sucursal seleccionada'
                };
            }

            const { data, error } = await supabase
                .from('deudas')
                .select(`
                    *,
                    cliente:cliente_id (
                        id,
                        name
                    )
                `)
                .eq('sucu_id', sucuId)
                .gte('fecha_deuda', fechaInicio)
                .lte('fecha_deuda', fechaFin)
                .order('fecha_deuda', { ascending: false });

            if (error) {
                console.error('Error al obtener deudas por rango de fechas:', error);
                throw new Error('Error al obtener las deudas');
            }

            return {
                success: true,
                data: data || []
            };

        } catch (error) {
            console.error('Error en getByDateRange deudas:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener las deudas'
            };
        }
    }

    // Actualizar estado de deuda (para marcar como pagada, vencida, etc.)
    static async updateEstado(id, nuevoEstado, nuevoSaldoPendiente = null) {
        try {
            const updateData = { estado: nuevoEstado };
            
            if (nuevoSaldoPendiente !== null) {
                updateData.saldo_pendiente = nuevoSaldoPendiente;
            }

            const { data, error } = await supabase
                .from('deudas')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error al actualizar estado de deuda:', error);
                throw new Error('Error al actualizar el estado de la deuda');
            }

            return {
                success: true,
                data: data,
                message: 'Estado de deuda actualizado correctamente'
            };

        } catch (error) {
            console.error('Error en updateEstado deuda:', error);
            return {
                success: false,
                message: error.message || 'Error al actualizar el estado de la deuda'
            };
        }
    }

    // Obtener deudas vencidas
    static async getDeudasVencidas(sucuId) {
        try {
            if (!sucuId) {
                return {
                    success: false,
                    message: 'No hay sucursal seleccionada'
                };
            }

            // Crear timestamp en zona horaria de Bolivia (GMT-4)
            const ahora = new Date();
            const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));
            const hoy = ahoraBolivia.toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('deudas')
                .select(`
                    *,
                    cliente:cliente_id (
                        id,
                        name
                    )
                `)
                .eq('sucu_id', sucuId)
                .eq('estado', 'pendiente')
                .lt('fecha_vencimiento', hoy)
                .order('fecha_vencimiento', { ascending: true });

            if (error) {
                console.error('Error al obtener deudas vencidas:', error);
                throw new Error('Error al obtener las deudas vencidas');
            }

            return {
                success: true,
                data: data || []
            };

        } catch (error) {
            console.error('Error en getDeudasVencidas:', error);
            return {
                success: false,
                message: error.message || 'Error al obtener las deudas vencidas'
            };
        }
    }

    // Registrar pago parcial y actualizar saldo/estado
    static async createPagoParcial({ deuda_id, monto, fecha, user_id = null, personal_id = null }) {
        try {
            // Obtener deuda actual
            const { data: deudaActual, error: deudaError } = await supabase
                .from('deudas')
                .select('*')
                .eq('id', deuda_id)
                .single();

            if (deudaError || !deudaActual) {
                console.error('Error obteniendo deuda para pago parcial:', deudaError);
                throw new Error('Deuda no encontrada');
            }

            const saldoAnterior = parseFloat(deudaActual.saldo_pendiente || 0);
            const montoPago = parseFloat(monto);
            const nuevoSaldo = Math.max(0, saldoAnterior - montoPago);

            // Insertar pago parcial
            const pagoData = {
                deuda_id,
                monto: montoPago,
                user_id: user_id || null,
                personal_id: personal_id || null
            };
            if (fecha) {
                // Guardar como timestamp o date según la columna; la tabla usa TIMESTAMPTZ
                pagoData.fecha = fecha;
            }

            const { data: pagoInsertado, error: pagoError } = await supabase
                .from('deuda_pagos_parciales')
                .insert([pagoData])
                .select()
                .single();

            if (pagoError) {
                console.error('Error insertando pago parcial:', pagoError);
                throw new Error('Error al registrar el pago parcial');
            }

            // Actualizar deuda con nuevo saldo y estado si corresponde
            const updateData = {
                saldo_pendiente: nuevoSaldo,
                estado: nuevoSaldo === 0 ? 'pagada' : deudaActual.estado
            };

            const { data: deudaActualizada, error: deudaUpdateError } = await supabase
                .from('deudas')
                .update(updateData)
                .eq('id', deuda_id)
                .select(`
                    *,
                    cliente:cliente_id (id, name),
                    user:user_id (id, first_name, last_name),
                    personal:personal_id (id, first_name, last_name)
                `)
                .single();

            if (deudaUpdateError) {
                console.error('Error actualizando deuda tras pago parcial:', deudaUpdateError);
                throw new Error('Error al actualizar la deuda');
            }

            // Procesar nombres
            const processedDeuda = { ...deudaActualizada };
            if (processedDeuda?.user) {
                processedDeuda.user = {
                    ...processedDeuda.user,
                    name: `${processedDeuda.user.first_name} ${processedDeuda.user.last_name}`.trim()
                };
            }
            if (processedDeuda?.personal) {
                processedDeuda.personal = {
                    ...processedDeuda.personal,
                    name: `${processedDeuda.personal.first_name} ${processedDeuda.personal.last_name}`.trim()
                };
            }

            return {
                success: true,
                data: {
                    deuda: processedDeuda,
                    pago: pagoInsertado
                },
                message: 'Pago parcial registrado correctamente'
            };

        } catch (error) {
            console.error('Error en createPagoParcial:', error);
            return { success: false, message: error.message || 'Error al registrar el pago parcial' };
        }
    }

    // Listar pagos parciales de una deuda
    static async getPagosParciales(deuda_id) {
        try {
            const { data, error } = await supabase
                .from('deuda_pagos_parciales')
                .select('*')
                .eq('deuda_id', deuda_id)
                .order('fecha', { ascending: false });

            if (error) {
                console.error('Error listando pagos parciales:', error);
                throw new Error('Error al obtener los pagos parciales');
            }

            return { success: true, data: data || [] };
        } catch (error) {
            console.error('Error en getPagosParciales:', error);
            return { success: false, message: error.message || 'Error al obtener los pagos parciales' };
        }
    }

    // Eliminar pago parcial y revertir saldo/estado si corresponde
    static async deletePagoParcial(deuda_id, pago_id) {
        try {
            // Obtener pago
            const { data: pago, error: pagoGetError } = await supabase
                .from('deuda_pagos_parciales')
                .select('*')
                .eq('id', pago_id)
                .single();

            if (pagoGetError || !pago) {
                console.error('Error obteniendo pago parcial:', pagoGetError);
                throw new Error('Pago parcial no encontrado');
            }

            if (pago.deuda_id !== deuda_id) {
                throw new Error('El pago no corresponde a la deuda indicada');
            }

            // Obtener deuda actual
            const { data: deudaActual, error: deudaError } = await supabase
                .from('deudas')
                .select('*')
                .eq('id', deuda_id)
                .single();

            if (deudaError || !deudaActual) {
                console.error('Error obteniendo deuda para revertir pago parcial:', deudaError);
                throw new Error('Deuda no encontrada');
            }

            const saldoAnterior = parseFloat(deudaActual.saldo_pendiente || 0);
            const montoPago = parseFloat(pago.monto || 0);
            const nuevoSaldo = saldoAnterior + montoPago;

            // Eliminar pago
            const { error: deleteError } = await supabase
                .from('deuda_pagos_parciales')
                .delete()
                .eq('id', pago_id);

            if (deleteError) {
                console.error('Error eliminando pago parcial:', deleteError);
                throw new Error('Error al eliminar el pago parcial');
            }

            // Actualizar deuda con nuevo saldo y estado según regla
            const updateData = {
                saldo_pendiente: nuevoSaldo,
                estado: nuevoSaldo > 0 ? 'pendiente' : 'pagada'
            };

            const { data: deudaActualizada, error: deudaUpdateError } = await supabase
                .from('deudas')
                .update(updateData)
                .eq('id', deuda_id)
                .select(`
                    *,
                    cliente:cliente_id (id, name),
                    user:user_id (id, first_name, last_name),
                    personal:personal_id (id, first_name, last_name)
                `)
                .single();

            if (deudaUpdateError) {
                console.error('Error actualizando deuda tras eliminar pago parcial:', deudaUpdateError);
                throw new Error('Error al actualizar la deuda');
            }

            // Procesar nombres
            const processedDeuda = { ...deudaActualizada };
            if (processedDeuda?.user) {
                processedDeuda.user = {
                    ...processedDeuda.user,
                    name: `${processedDeuda.user.first_name} ${processedDeuda.user.last_name}`.trim()
                };
            }
            if (processedDeuda?.personal) {
                processedDeuda.personal = {
                    ...processedDeuda.personal,
                    name: `${processedDeuda.personal.first_name} ${processedDeuda.personal.last_name}`.trim()
                };
            }

            return {
                success: true,
                data: processedDeuda,
                message: 'Pago parcial eliminado y deuda actualizada'
            };
        } catch (error) {
            console.error('Error en deletePagoParcial:', error);
            return { success: false, message: error.message || 'Error al eliminar el pago parcial' };
        }
    }
}

module.exports = deudas;
