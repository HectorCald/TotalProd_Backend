const reglasProduccionDamabrava = require('../models/reglasProduccionDamabrava');

class reglasProduccionDamabravaController {
    static async create(req, res) {
        try {
            const {
                tipo,
                general,
                contiene,
                producto_almacen_id,
                sellado,
                cernido,
                envasado,
                etiquetado,
                desde_gramaje,
                hasta_gramaje,
                empresa_id
            } = req.body;

            const userId = req.user?.id || null;
            const userType = req.user?.type || 'user';

            const finalUserId = userType === 'employee' ? null : userId;
            const finalPersonalId = userType === 'employee' ? userId : null;

            const empresaId = empresa_id || req.user?.empresa_id;

            if (!empresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'El identificador de la empresa es obligatorio'
                });
            }

            const numericFields = {
                sellado: parseFloat(sellado),
                cernido: parseFloat(cernido),
                envasado: parseFloat(envasado),
                etiquetado: parseFloat(etiquetado)
            };

            for (const [key, value] of Object.entries(numericFields)) {
                if (Number.isNaN(value)) {
                    return res.status(400).json({
                        success: false,
                        message: `El campo ${key} debe ser un número válido`
                    });
                }
            }

            const reglaTipo = (tipo || 'general').toLowerCase();

            let finalGeneral = null;
            if (reglaTipo === 'general') {
                finalGeneral = Boolean(general);
            } else if (reglaTipo === 'especial') {
                finalGeneral = false;
            }

            let finalContiene = null;
            if (reglaTipo === 'general' && finalGeneral === false) {
                if (!contiene || !contiene.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Debe indicar el texto de "producto contiene" cuando la regla no es general'
                    });
                }
                finalContiene = contiene.trim();
            } else if (reglaTipo === 'especial') {
                if (!contiene || !contiene.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Debe indicar el texto de "producto contiene" para la regla especial'
                    });
                }
                finalContiene = contiene.trim();
            }

            let finalProductoId = null;
            if (reglaTipo === 'especial') {
                finalProductoId = producto_almacen_id || null;
                if (!finalProductoId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Debe seleccionar un producto válido para la regla especial'
                    });
                }
            }

            let finalDesdeGramaje = null;
            let finalHastaGramaje = null;
            if (reglaTipo === 'gramaje') {
                finalDesdeGramaje = parseFloat(desde_gramaje);
                finalHastaGramaje = parseFloat(hasta_gramaje);

                if (Number.isNaN(finalDesdeGramaje) || Number.isNaN(finalHastaGramaje)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Los campos "desde" y "hasta" deben ser números válidos para la regla por gramaje'
                    });
                }
            }

            const ruleData = {
                empresa_id: empresaId,
                general: finalGeneral,
                contiene: finalContiene,
                producto_almacen_id: finalProductoId,
                sellado: numericFields.sellado,
                cernido: numericFields.cernido,
                envasado: numericFields.envasado,
                etiquetado: numericFields.etiquetado,
                desde_gramaje: finalDesdeGramaje,
                hasta_gramaje: finalHastaGramaje,
                user_id: finalUserId,
                personal_id: finalPersonalId
            };

            const result = await reglasProduccionDamabrava.create(ruleData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(201).json({
                success: true,
                message: 'Regla de producción registrada correctamente',
                data: {
                    ...result.data,
                    tipo: reglaTipo
                }
            });
        } catch (error) {
            console.error('Error en reglasProduccionDamabravaController.create:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    static async getAll(req, res) {
        try {
            const empresaId = req.query.empresa_id || req.user?.empresa_id;

            if (!empresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'El identificador de la empresa es obligatorio'
                });
            }

            const result = await reglasProduccionDamabrava.getAll(empresaId);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('Error en reglasProduccionDamabravaController.getAll:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = reglasProduccionDamabravaController;

