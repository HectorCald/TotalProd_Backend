const { supabase, retryOperation } = require('../config/supabase');

class Historial {
    static normalizePayload(payload = {}) {
        const {
            modulo,
            accion,
            lugar_afectado,
            registro_id,
            empresa_id,
            user_id = null,
            personal_id = null,
            detalles = {},
            fecha = new Date().toISOString()
        } = payload;

        if (!empresa_id) {
            throw new Error('El campo empresa_id es obligatorio para registrar el historial.');
        }

        if (!modulo) {
            throw new Error('El campo modulo es obligatorio para registrar el historial.');
        }

        if (!accion) {
            throw new Error('El campo accion es obligatorio para registrar el historial.');
        }

        if (!lugar_afectado) {
            throw new Error('El campo lugar_afectado es obligatorio para registrar el historial.');
        }

        return {
            fecha,
            modulo,
            accion: accion.toUpperCase(),
            lugar_afectado,
            registro_id: registro_id || null,
            empresa_id,
            user_id: user_id || null,
            personal_id: personal_id || null,
            detalles: detalles || {}
        };
    }

    static async create(payload) {
        const insertData = Historial.normalizePayload(payload);

        try {
            const { data, error } = await retryOperation(async () => {
                const response = await supabase
                    .from('historial_acciones')
                    .insert(insertData)
                    .select(`
                        *,
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

                if (response.error) {
                    throw response.error;
                }

                return response;
            });

            const processedData = { ...data };

            if (data?.user) {
                processedData.user = {
                    ...data.user,
                    name: `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim()
                };
            }

            if (data?.personal) {
                processedData.personal = {
                    ...data.personal,
                    name: `${data.personal.first_name || ''} ${data.personal.last_name || ''}`.trim()
                };
            }

            return {
                success: true,
                data: processedData
            };
        } catch (error) {
            console.error('Error en Historial.create:', error);
            return {
                success: false,
                message: 'Error al registrar el historial',
                error
            };
        }
    }

    static async getAll(filters = {}) {
        try {
            const {
                empresa_id,
                modulo = null,
                accion = null,
                registro_id = null,
                user_id = null,
                personal_id = null,
                limit = 50,
                offset = 0
            } = filters;

            if (!empresa_id) {
                throw new Error('El campo empresa_id es obligatorio para obtener el historial.');
            }

            let query = supabase
                .from('historial_acciones')
                .select(`
                    *,
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
                `, { count: 'exact' })
                .eq('empresa_id', empresa_id)
                .order('fecha', { ascending: false })
                .range(offset, offset + limit - 1);

            if (modulo) {
                query = query.eq('modulo', modulo);
            }

            if (accion) {
                query = query.eq('accion', accion.toUpperCase());
            }

            if (registro_id) {
                query = query.eq('registro_id', registro_id);
            }

            if (user_id) {
                query = query.eq('user_id', user_id);
            }

            if (personal_id) {
                query = query.eq('personal_id', personal_id);
            }

            const { data, error, count } = await query;

            if (error) {
                throw error;
            }

            const processedData = (data || []).map(entry => {
                const processed = { ...entry };

                if (entry.user) {
                    processed.user = {
                        ...entry.user,
                        name: `${entry.user.first_name || ''} ${entry.user.last_name || ''}`.trim()
                    };
                }

                if (entry.personal) {
                    processed.personal = {
                        ...entry.personal,
                        name: `${entry.personal.first_name || ''} ${entry.personal.last_name || ''}`.trim()
                    };
                }

                return processed;
            });

            return {
                success: true,
                data: processedData,
                pagination: {
                    total: count || 0,
                    limit,
                    offset
                }
            };
        } catch (error) {
            console.error('Error en Historial.getAll:', error);
            return {
                success: false,
                message: 'Error al obtener el historial',
                error
            };
        }
    }

    static async getById(id) {
        try {
            if (!id) {
                throw new Error('El campo id es obligatorio para obtener un registro de historial.');
            }

            const { data, error } = await supabase
                .from('historial_acciones')
                .select(`
                    *,
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
                .eq('id', id)
                .single();

            if (error) {
                throw error;
            }

            const processed = { ...data };

            if (data?.user) {
                processed.user = {
                    ...data.user,
                    name: `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim()
                };
            }

            if (data?.personal) {
                processed.personal = {
                    ...data.personal,
                    name: `${data.personal.first_name || ''} ${data.personal.last_name || ''}`.trim()
                };
            }

            return {
                success: true,
                data: processed
            };
        } catch (error) {
            console.error('Error en Historial.getById:', error);
            return {
                success: false,
                message: 'Error al obtener el registro de historial',
                error
            };
        }
    }
}

module.exports = Historial;

