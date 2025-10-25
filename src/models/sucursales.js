const { supabase } = require('../config/supabase');

const sucursales = {
    // Obtener todas las sucursales de una empresa
    async getByEmpresaId(empresaId) {
        try {
            const { data, error } = await supabase
                .from('sucursales')
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id
                    )
                `)
                .eq('empresa_id', empresaId)
                .order('created_at', { ascending: true });

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: data || []
            };
        } catch (error) {
            console.error('Error en sucursales.getByEmpresaId:', error);
            return {
                success: false,
                message: 'Error al obtener las sucursales',
                error: error.message
            };
        }
    },

    // Obtener sucursal por ID
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('sucursales')
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id
                    )
                `)
                .eq('id', id)
                .single();

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Error en sucursales.getById:', error);
            return {
                success: false,
                message: 'Error al obtener la sucursal',
                error: error.message
            };
        }
    },

    // Crear nueva sucursal
    async create(sucursalData) {
        try {
            const { data, error } = await supabase
                .from('sucursales')
                .insert([sucursalData])
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id
                    )
                `)
                .single();

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Error en sucursales.create:', error);
            return {
                success: false,
                message: 'Error al crear la sucursal',
                error: error.message
            };
        }
    },

    // Actualizar sucursal
    async update(id, sucursalData) {
        try {
            const { data, error } = await supabase
                .from('sucursales')
                .update(sucursalData)
                .eq('id', id)
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id
                    )
                `)
                .single();

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error('Error en sucursales.update:', error);
            return {
                success: false,
                message: 'Error al actualizar la sucursal',
                error: error.message
            };
        }
    },

    // Eliminar sucursal
    async delete(id) {
        try {
            // Primero verificar si la sucursal existe
            const sucursalExistente = await this.getById(id);
            if (!sucursalExistente.success) {
                return {
                    success: false,
                    message: 'La sucursal no existe'
                };
            }

            // Verificar si la sucursal tiene dependencias
            // Verificar si hay movimientos de acopio asociados
            const { data: movimientosAcopio, error: errorAcopio } = await supabase
                .from('movimientos_acopio')
                .select('id')
                .eq('sucursal_id', id)
                .limit(1);

            if (errorAcopio) {
                console.error('Error verificando movimientos de acopio:', errorAcopio);
            }

            // Verificar si hay movimientos de almacén asociados
            const { data: movimientosAlmacen, error: errorAlmacen } = await supabase
                .from('movimientos_almacen')
                .select('id')
                .eq('sucursal_id', id)
                .limit(1);

            if (errorAlmacen) {
                console.error('Error verificando movimientos de almacén:', errorAlmacen);
            }

            // Verificar si hay pedidos asociados
            const { data: pedidosAcopio, error: errorPedidosAcopio } = await supabase
                .from('pedidos_acopio')
                .select('id')
                .eq('sucursal_id', id)
                .limit(1);

            if (errorPedidosAcopio) {
                console.error('Error verificando pedidos de acopio:', errorPedidosAcopio);
            }

            const { data: pedidosAlmacen, error: errorPedidosAlmacen } = await supabase
                .from('pedidos_almacen')
                .select('id')
                .eq('sucursal_id', id)
                .limit(1);

            if (errorPedidosAlmacen) {
                console.error('Error verificando pedidos de almacén:', errorPedidosAlmacen);
            }

            // Verificar si hay personal asociado
            const { data: personal, error: errorPersonal } = await supabase
                .from('personal')
                .select('id')
                .eq('sucursal_id', id)
                .limit(1);

            if (errorPersonal) {
                console.error('Error verificando personal:', errorPersonal);
            }

            // Si hay dependencias, no permitir la eliminación
            if (movimientosAcopio && movimientosAcopio.length > 0) {
                return {
                    success: false,
                    message: 'No se puede eliminar la sucursal porque tiene movimientos de acopio asociados'
                };
            }

            if (movimientosAlmacen && movimientosAlmacen.length > 0) {
                return {
                    success: false,
                    message: 'No se puede eliminar la sucursal porque tiene movimientos de almacén asociados'
                };
            }

            if (pedidosAcopio && pedidosAcopio.length > 0) {
                return {
                    success: false,
                    message: 'No se puede eliminar la sucursal porque tiene pedidos de acopio asociados'
                };
            }

            if (pedidosAlmacen && pedidosAlmacen.length > 0) {
                return {
                    success: false,
                    message: 'No se puede eliminar la sucursal porque tiene pedidos de almacén asociados'
                };
            }

            if (personal && personal.length > 0) {
                return {
                    success: false,
                    message: 'No se puede eliminar la sucursal porque tiene personal asociado'
                };
            }

            // Si no hay dependencias, proceder con la eliminación
            const { error } = await supabase
                .from('sucursales')
                .delete()
                .eq('id', id);

            if (error) {
                // Manejar errores específicos de Supabase
                if (error.code === '23503') {
                    return {
                        success: false,
                        message: 'No se puede eliminar la sucursal porque tiene registros relacionados en otras tablas'
                    };
                } else if (error.code === '23502') {
                    return {
                        success: false,
                        message: 'Error de integridad: la sucursal tiene campos requeridos que no pueden ser nulos'
                    };
                } else {
                    return {
                        success: false,
                        message: `Error de base de datos: ${error.message}`,
                        error: error.message
                    };
                }
            }

            return {
                success: true,
                message: 'Sucursal eliminada correctamente'
            };
        } catch (error) {
            console.error('Error en sucursales.delete:', error);
            return {
                success: false,
                message: `Error inesperado al eliminar la sucursal: ${error.message}`,
                error: error.message
            };
        }
    }
};

module.exports = sucursales;
