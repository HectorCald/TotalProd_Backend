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
            const { error } = await supabase
                .from('sucursales')
                .delete()
                .eq('id', id);

            if (error) {
                throw error;
            }

            return {
                success: true,
                message: 'Sucursal eliminada correctamente'
            };
        } catch (error) {
            console.error('Error en sucursales.delete:', error);
            return {
                success: false,
                message: 'Error al eliminar la sucursal',
                error: error.message
            };
        }
    }
};

module.exports = sucursales;
