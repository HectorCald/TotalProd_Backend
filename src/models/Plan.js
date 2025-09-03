
const { supabase } = require('../config/supabase');

class Plan {

    // Constructor para crear un plan
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.price = data.price;
        this.duration = data.duration;
        this.description = data.description;
        this.created_at = data.created_at;
        this.modules = data.modules || [];
    }

    // Método estático para obtener todos los planes con sus módulos
    static async getAll() {
        try {
            const { data: plans, error } = await supabase
                .from('plans')
                .select(`
                    *,
                    plan_modules!inner (
                        modules (
                            id,
                            name,
                            description
                        )
                    )
                `)
                .order('price', { ascending: true });

            if (error) {
                console.error('Error al obtener planes:', error);
                throw new Error('No se pudieron obtener los planes');
            }

            // Procesar los datos para extraer los módulos
            const processedPlans = plans.map(plan => {
                const modules = plan.plan_modules?.map(pm => pm.modules) || [];
                return {
                    ...plan,
                    modules: modules
                };
            });

            return processedPlans.map(plan => new Plan(plan));
        } catch (error) {
            console.error('Error en Plan.getAll:', error);
            throw new Error('Error al obtener los planes');
        }
    }

    // Método estático para obtener un plan por ID
    static async getById(id) {
        try {
            const { data: plan, error } = await supabase
                .from('plans')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Plan no encontrado
                }
                console.error('Error al obtener plan por ID:', error);
                throw new Error('No se pudo obtener el plan');
            }

            return new Plan(plan);
        } catch (error) {
            console.error('Error en Plan.getById:', error);
            throw new Error('Error al obtener el plan');
        }
    }
}

module.exports = Plan;
