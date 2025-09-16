const { supabase } = require('../config/supabase');

const modules = {
    // Obtener todos los módulos con sus submódulos
    async getAll() {
        try {
            const { data, error } = await supabase
                .from('modules')
                .select(`
                    id,
                    name,
                    description,
                    created_at,
                    sub_modulos (
                        id,
                        name
                    )
                `)
                .order('name', { ascending: true });

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: data || []
            };
        } catch (error) {
            console.error('Error en modules.getAll:', error);
            return {
                success: false,
                message: 'Error al obtener los módulos',
                error: error.message
            };
        }
    },

    // Obtener un módulo específico con sus submódulos
    async getById(id) {
        try {
            const { data, error } = await supabase
                .from('modules')
                .select(`
                    id,
                    name,
                    description,
                    created_at,
                    sub_modulos (
                        id,
                        name
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
            console.error('Error en modules.getById:', error);
            return {
                success: false,
                message: 'Error al obtener el módulo',
                error: error.message
            };
        }
    }
};

module.exports = modules;
