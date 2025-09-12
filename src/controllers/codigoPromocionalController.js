const codigoPromocional = require('../models/codigoPromocional');

class codigoPromocionalController {

  // Validar código promocional
  static async validarCodigo(req, res) {
    try {
        const { codigo } = req.body;
        const userId = req.user.id;

        if (!codigo || codigo.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'El código promocional es requerido'
            });
        }

        // Validar el código
        const resultado = await codigoPromocional.validarCodigo(codigo.trim(), userId);

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        // Calcular duración en meses
        // La duración del plan viene como INTERVAL (ej: "1 mon"), necesitamos extraer los meses
        const planDurationInterval = resultado.data.plans.duration;
        const codigoDuration = resultado.data.duracion; // El campo se llama 'duracion' no 'duration'
        
        let planDurationMonths = 1; // Valor por defecto
        
        if (planDurationInterval) {
            // Formato: "1 mon", "12 mons", "1 year", etc.
            const match = planDurationInterval.match(/(\d+)\s*(mon|month|year)/i);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2].toLowerCase();
                planDurationMonths = unit === 'year' ? value * 12 : value;
            }
        }
        
        const durationMonths = planDurationMonths * codigoDuration;

        res.json({
            success: true,
            message: 'Código válido',
            data: {
                plan: resultado.data.plans,
                duration: durationMonths,
                codigoId: resultado.data.id
            }
        });

    } catch (error) {
        console.error('Error en validarCodigo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

  // Aplicar código promocional
  static async aplicarCodigo(req, res) {
    try {
        const { codigoId } = req.body;
        const userId = req.user.id;

        if (!codigoId) {
            return res.status(400).json({
                success: false,
                message: 'ID del código es requerido'
            });
        }

        // Obtener información del código
        const { supabase } = require('../config/supabase');
        const { data: codigoData, error: codigoError } = await supabase
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
            .eq('id', codigoId)
            .single();

        if (codigoError || !codigoData) {
            return res.status(404).json({
                success: false,
                message: 'Código promocional no encontrado'
            });
        }

        // Calcular duración en meses
        // La duración del plan viene como INTERVAL (ej: "1 mon"), necesitamos extraer los meses
        const planDurationInterval = codigoData.plans.duration;
        const codigoDuration = codigoData.duracion; // El campo se llama 'duracion' no 'duration'
        
        let planDurationMonths = 1; // Valor por defecto
        
        if (planDurationInterval) {
            // Formato: "1 mon", "12 mons", "1 year", etc.
            const match = planDurationInterval.match(/(\d+)\s*(mon|month|year)/i);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2].toLowerCase();
                planDurationMonths = unit === 'year' ? value * 12 : value;
            }
        }
        
        const durationMonths = planDurationMonths * codigoDuration;

        // Aplicar el código
        const resultado = await codigoPromocional.usarCodigo(
            codigoId,
            userId,
            codigoData.plan_id,
            durationMonths
        );

        if (!resultado.success) {
            return res.status(400).json(resultado);
        }

        res.json({
            success: true,
            message: 'Código promocional aplicado correctamente',
            data: {
                plan: codigoData.plans,
                duration: durationMonths,
                endDate: resultado.data.endDate
            }
        });

    } catch (error) {
        console.error('Error en aplicarCodigo:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

  // Obtener todos los códigos (para administradores)
  static async getAll(req, res) {
    try {
        const resultado = await codigoPromocional.getAll();

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        console.error('Error en getAll:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

  // Crear código promocional (para administradores)
  static async create(req, res) {
    try {
        const { codigo, planId, duration } = req.body;

        if (!codigo || !planId || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }

        const resultado = await codigoPromocional.create(codigo, planId, duration);

        if (!resultado.success) {
            return res.status(500).json(resultado);
        }

        res.json(resultado);

    } catch (error) {
        console.error('Error en create:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};

}

module.exports = codigoPromocionalController;
