const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class codigoPromocional {
    // Obtener todos los códigos promocionales
    static async getAll() {
        try {
            const { data, error } = await supabase
                .from('codigo_promocional')
                .select(`
                    *,
                    plans (
                        id,
                        name,
                        price,
                        duration,
                        description
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                success: true,
                data: data || []
            };
        } catch (error) {
            console.error('Error en CodigoPromocional.getAll:', error);
            return {
                success: false,
                message: 'Error al obtener códigos promocionales',
                error: error.message
            };
        }
    }

    // Validar código promocional
    static async validarCodigo(codigo, userId) {
        try {
            // Obtener todos los códigos promocionales
            const { data: codigos, error: codigosError } = await supabase
                .from('codigo_promocional')
                .select(`
                    *,
                    plans (
                        id,
                        name,
                        price,
                        duration,
                        description
                    )
                `);

            if (codigosError) throw codigosError;

            // Buscar el código que coincida
            let codigoEncontrado = null;
            for (const codigoPromo of codigos) {
                const isValid = await bcrypt.compare(codigo, codigoPromo.code_hash);
                if (isValid) {
                    codigoEncontrado = codigoPromo;
                    break;
                }
            }

            if (!codigoEncontrado) {
                return {
                    success: false,
                    message: 'Código promocional no válido'
                };
            }

            // Verificar si el usuario ya usó este código
            const { data: usoAnterior, error: usoError } = await supabase
                .from('codigo_promo_user')
                .select('id')
                .eq('codigo_promo_id', codigoEncontrado.id)
                .eq('user_id', userId)
                .single();

            if (usoError && usoError.code !== 'PGRST116') { // PGRST116 = no rows found
                throw usoError;
            }

            if (usoAnterior) {
                return {
                    success: false,
                    message: 'Ya has usado este código promocional'
                };
            }

            return {
                success: true,
                data: codigoEncontrado
            };

        } catch (error) {
            console.error('Error en CodigoPromocional.validarCodigo:', error);
            return {
                success: false,
                message: 'Error al validar código promocional',
                error: error.message
            };
        }
    }

    // Usar código promocional
    static async usarCodigo(codigoPromoId, userId, planId, durationMonths) {
        try {
            // Calcular la fecha de vencimiento
            const now = new Date();
            const endDate = new Date(now.getTime() + (durationMonths * 30 * 24 * 60 * 60 * 1000)); // Aproximadamente durationMonths meses

            // 1. Desactivar todos los planes activos del usuario
            const { error: deactivateError } = await supabase
                .from('user_plans')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('is_active', true);

            if (deactivateError) throw deactivateError;

            // 2. Obtener el plan gratuito para eliminarlo
            const { data: freePlan, error: freePlanError } = await supabase
                .from('plans')
                .select('id')
                .eq('name', 'Free')
                .single();

            if (freePlanError && freePlanError.code !== 'PGRST116') { // PGRST116 means no rows found
                throw freePlanError;
            }

            // 3. Si existe plan gratuito, eliminar todos los planes gratuitos del usuario
            if (freePlan) {
                const { error: deleteFreeError } = await supabase
                    .from('user_plans')
                    .delete()
                    .eq('user_id', userId)
                    .eq('plan_id', freePlan.id);

                if (deleteFreeError) throw deleteFreeError;
            }

            // 4. Asignar el nuevo plan al usuario
            const { error: planError } = await supabase
                .from('user_plans')
                .insert({
                    user_id: userId,
                    plan_id: planId,
                    start_date: now.toISOString(),
                    end_date: endDate.toISOString(),
                    is_active: true
                });

            if (planError) throw planError;

            // 5. Registrar que el usuario usó el código
            const { error: usoError } = await supabase
                .from('codigo_promo_user')
                .insert({
                    codigo_promo_id: codigoPromoId,
                    user_id: userId
                });

            if (usoError) throw usoError;

            return {
                success: true,
                message: 'Código promocional aplicado correctamente',
                data: {
                    planId,
                    durationMonths,
                    endDate: endDate.toISOString()
                }
            };

        } catch (error) {
            console.error('Error en CodigoPromocional.usarCodigo:', error);
            return {
                success: false,
                message: 'Error al aplicar código promocional',
                error: error.message
            };
        }
    }

    // Crear código promocional (para administradores)
    static async create(codigo, planId, duration) {
        try {
            // Hashear el código
            const codeHash = await bcrypt.hash(codigo, 10);

            const { data, error } = await supabase
                .from('codigo_promocional')
                .insert({
                    code_hash: codeHash,
                    plan_id: planId,
                    duration: duration
                })
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                data: data,
                message: 'Código promocional creado correctamente'
            };

        } catch (error) {
            console.error('Error en CodigoPromocional.create:', error);
            return {
                success: false,
                message: 'Error al crear código promocional',
                error: error.message
            };
        }
    }
}

module.exports = codigoPromocional;
