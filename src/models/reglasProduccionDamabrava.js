const { supabase } = require('../config/supabase');

const parseDecimal = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
};

class reglasProduccionDamabrava {
    static async create(ruleData) {
        try {
            const insertData = {
                empresa_id: ruleData.empresa_id,
                general: typeof ruleData.general === 'boolean' ? ruleData.general : null,
                contiene: (() => {
                    if (ruleData.general === false || ruleData.general === null) {
                        const text = ruleData.contiene || '';
                        return text.trim() ? text.trim() : null;
                    }
                    return null;
                })(),
                producto_almacen_id: ruleData.general === false ? ruleData.producto_almacen_id || null : null,
                sellado: parseDecimal(ruleData.sellado),
                cernido: parseDecimal(ruleData.cernido),
                envasado: parseDecimal(ruleData.envasado),
                etiquetado: parseDecimal(ruleData.etiquetado),
                user_id: ruleData.user_id || null,
                personal_id: ruleData.personal_id || null,
                desde_gramaje: ruleData.general === null ? parseDecimal(ruleData.desde_gramaje) : null,
                hasta_gramaje: ruleData.general === null ? parseDecimal(ruleData.hasta_gramaje) : null
            };

            const { data: insertResponse, error: insertError } = await supabase
                .from('reglas_produccion')
                .insert(insertData)
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name
                    )
                `)
                .single();

            if (insertError) {
                return {
                    success: false,
                    message: insertError.message || 'Error al registrar la regla de producción',
                    error: insertError
                };
            }

            const { data: fullRule, error: fetchError } = await supabase
                .from('reglas_produccion')
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name
                    )
                `)
                .eq('id', insertResponse.id)
                .single();

            if (fetchError) {
                return {
                    success: false,
                    message: fetchError.message || 'Regla creada pero no se pudo obtener la información completa',
                    error: fetchError
                };
            }

            return {
                success: true,
                data: fullRule
            };
        } catch (error) {
            return {
                success: false,
                message: 'Error interno del servidor',
                error
            };
        }
    }

    static async getAll(empresaId) {
        try {
            const { data, error } = await supabase
                .from('reglas_produccion')
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name
                    )
                `)
                .eq('empresa_id', empresaId)
                .order('fecha', { ascending: false });

            if (error) {
                return {
                    success: false,
                    message: error.message || 'Error al obtener las reglas de producción',
                    error
                };
            }

            return {
                success: true,
                data: data || []
            };
        } catch (error) {
            return {
                success: false,
                message: 'Error interno del servidor',
                error
            };
        }
    }

    static async existeReglaGeneral(empresaId) {
        try {
            const { data, error } = await supabase
                .from('reglas_produccion')
                .select('id')
                .eq('empresa_id', empresaId)
                .eq('general', true)
                .limit(1);

            if (error) {
                return {
                    success: false,
                    message: error.message || 'Error al verificar reglas generales',
                    error
                };
            }

            return {
                success: true,
                existe: Array.isArray(data) && data.length > 0
            };
        } catch (error) {
            return {
                success: false,
                message: 'Error interno del servidor',
                error
            };
        }
    }

    static async delete(reglaId, empresaId) {
        try {
            const { data: regla, error: fetchError } = await supabase
                .from('reglas_produccion')
                .select('id, empresa_id')
                .eq('id', reglaId)
                .single();

            if (fetchError || !regla) {
                return {
                    success: false,
                    message: 'Regla no encontrada'
                };
            }

            if (empresaId && regla.empresa_id && regla.empresa_id !== empresaId) {
                return {
                    success: false,
                    message: 'No tienes permisos para eliminar esta regla'
                };
            }

            const { error: deleteError } = await supabase
                .from('reglas_produccion')
                .delete()
                .eq('id', reglaId);

            if (deleteError) {
                return {
                    success: false,
                    message: deleteError.message || 'Error al eliminar la regla',
                    error: deleteError
                };
            }

            return {
                success: true,
                message: 'Regla eliminada correctamente'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Error interno del servidor',
                error
            };
        }
    }
}

module.exports = reglasProduccionDamabrava;

