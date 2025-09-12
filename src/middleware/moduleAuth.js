const User = require('../models/User');
const { supabase } = require('../config/supabase');

// Middleware para verificar acceso a módulos según el plan
const requireModuleAccess = (moduleName) => {
    return async (req, res, next) => {
        try {
            // Obtener el ID del usuario del token (ya verificado por requireAuth)
            const userId = req.user.id;
            console.log(`🔍 Verificando acceso al módulo "${moduleName}" para usuario ${userId}`);
            
            // Obtener el usuario con su plan y módulos
            const user = await User.getById(userId);
            
            if (!user) {
                console.log(`❌ Usuario ${userId} no encontrado`);
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            console.log(`👤 Usuario encontrado: ${user.firstName} ${user.lastName}`);
            console.log(`📋 Plan actual: ${user.plan?.name || 'Sin plan'}`);
            console.log(`🔄 Plan activo: ${user.plan?.is_active || false}`);
            console.log(`📦 Módulos disponibles: ${user.modules?.length || 0}`);
            
            // Verificar si el usuario tiene un plan asignado
            if (!user.plan) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes un plan activo. Actualiza tu plan para acceder a esta función.',
                    code: 'NO_PLAN'
                });
            }

            // Verificar si el plan está vencido por end_date
            const now = new Date();
            const endDate = user.plan.end_date ? new Date(user.plan.end_date) : null;
            const isExpired = endDate && endDate < now;
            
            console.log(`📅 Fecha actual: ${now.toISOString()}`);
            console.log(`📅 Fecha fin del plan: ${user.plan.end_date || 'Sin fecha'}`);
            console.log(`⏰ Plan vencido: ${isExpired}`);

            // Si el plan está vencido, desactivarlo y asignar plan gratuito
            if (isExpired) {
                console.log(`🔄 Plan vencido detectado para usuario ${userId}. Asignando plan gratuito...`);
                
                try {
                    // Asignar el plan gratuito (updatePlan ya desactiva el plan actual)
                    await User.updatePlan(userId, 'Free');
                    
                    console.log(`✅ Plan gratuito asignado exitosamente para usuario ${userId}`);
                    
                    // Obtener el usuario actualizado con el plan gratuito
                    const updatedUser = await User.getById(userId);
                    
                    if (!updatedUser || !updatedUser.plan) {
                        console.error(`❌ Error: No se pudo obtener usuario actualizado para ${userId}`);
                        return res.status(500).json({
                            success: false,
                            message: 'Error al asignar el plan gratuito'
                        });
                    }

                    console.log(`📋 Usuario actualizado - Plan: ${updatedUser.plan.name}, Módulos: ${updatedUser.modules?.length || 0}`);

                    // Verificar si el plan gratuito tiene el módulo requerido
                    const hasModule = updatedUser.modules?.some(module => 
                        module.name.toLowerCase() === moduleName.toLowerCase()
                    );
                    
                    if (!hasModule) {
                        console.log(`❌ Plan gratuito no tiene módulo "${moduleName}"`);
                        return res.status(403).json({
                            success: false,
                            message: `Tu plan gratuito no incluye acceso al módulo "${moduleName}". Actualiza tu plan para acceder a esta función.`,
                            code: 'MODULE_NOT_INCLUDED',
                            currentPlan: updatedUser.plan.name,
                            requiredModule: moduleName
                        });
                    }

                    console.log(`✅ Módulo "${moduleName}" encontrado en plan gratuito. Continuando...`);
                    // Si el plan gratuito tiene el módulo, continuar
                    next();
                    return;
                    
                } catch (error) {
                    console.error('❌ Error al asignar plan gratuito:', error);
                    return res.status(500).json({
                        success: false,
                        message: 'Error al asignar el plan gratuito'
                    });
                }
            }
            
            // Verificar si el plan tiene el módulo requerido
            const hasModule = user.modules?.some(module => 
                module.name.toLowerCase() === moduleName.toLowerCase()
            );
            
            if (!hasModule) {
                return res.status(403).json({
                    success: false,
                    message: `Tu plan actual (${user.plan.name}) no incluye acceso al módulo "${moduleName}". Actualiza tu plan para acceder a esta función.`,
                    code: 'MODULE_NOT_INCLUDED',
                    currentPlan: user.plan.name,
                    requiredModule: moduleName
                });
            }
            
            next();
            
        } catch (error) {
            console.error('Error en requireModuleAccess:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al verificar permisos'
            });
        }
    };
};

module.exports = {
    requireModuleAccess
};
