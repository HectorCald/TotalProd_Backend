const User = require('../models/User');
const { supabase } = require('../config/supabase');

// Middleware para verificar acceso a módulos según el plan del propietario de la empresa
const requireModuleAccess = (moduleName) => {
    return async (req, res, next) => {
        try {
      // Obtener el empresa_id del localStorage (enviado desde el frontend)
      let empresaId = req.body.empresa_id || req.query.empresa_id || req.params.empresaId;
      
      // Si no hay empresa_id pero la URL contiene /empresa/, extraer el ID de la URL
      if (!empresaId && req.url.includes('/empresa/')) {
        const match = req.url.match(/\/empresa\/([^\/\?]+)/);
        if (match) {
          empresaId = match[1];
        }
      }
      
      // Si no hay empresa_id pero hay sucu_id, obtener empresa_id de la sucursal
      if (!empresaId && (req.query.sucu_id || req.body.sucu_id)) {
        const sucuId = req.query.sucu_id || req.body.sucu_id;
        try {
          const { data: sucursal, error } = await supabase
            .from('sucursales')
            .select('empresa_id')
            .eq('id', sucuId)
            .single();
          
          if (!error && sucursal) {
            empresaId = sucursal.empresa_id;
            console.log('🔍 moduleAuth - empresa_id obtenido de sucu_id:', empresaId);
          }
        } catch (error) {
          console.error('Error al obtener empresa_id de sucu_id:', error);
        }
      }
            
            // Para operaciones de eliminación y actualización, no requerir empresa_id
            if (!empresaId && (req.method === 'DELETE' || req.method === 'PUT' || req.method === 'PATCH')) {
                next();
                return;
            }
            
            if (!empresaId) {
                console.log('❌ moduleAuth - No se encontró empresa_id');
                return res.status(400).json({
                    success: false,
                    message: 'ID de la empresa es requerido'
                });
            }
            
            // Obtener el plan del propietario de la empresa
            const plan = await User.getPlanByEmpresaId(empresaId);
            
            if (!plan) {
                return res.status(403).json({
                    success: false,
                    message: 'La empresa no tiene un plan activo. Actualiza el plan para acceder a esta función.',
                    code: 'NO_PLAN'
                });
            }

            // Verificar si el plan está vencido por end_date
            const now = new Date();
            const endDate = plan.end_date ? new Date(plan.end_date) : null;
            const isExpired = endDate && endDate < now;
            
            // Si el plan está vencido, obtener el plan gratuito del propietario
            if (isExpired) {
                try {
                    // Obtener el plan gratuito del propietario
                    const freePlan = await User.getPlanByEmpresaId(empresaId);
                    
                    if (!freePlan) {
                        return res.status(403).json({
                            success: false,
                            message: `El plan de la empresa ha expirado y no se pudo asignar el plan gratuito. Actualiza el plan para acceder a esta función.`,
                            code: 'PLAN_EXPIRED'
                        });
                    }

                    // Verificar si el plan gratuito tiene el módulo requerido
                    const hasModule = freePlan.modules?.some(module => 
                        module.name.toLowerCase() === moduleName.toLowerCase()
                    );
                    
                    if (!hasModule) {
                        return res.status(403).json({
                            success: false,
                            message: `El plan gratuito de la empresa no incluye acceso al módulo "${moduleName}". Actualiza el plan para acceder a esta función.`,
                            code: 'MODULE_NOT_INCLUDED',
                            currentPlan: freePlan.name,
                            requiredModule: moduleName
                        });
                    }

                    // Si el plan gratuito tiene el módulo, continuar
                    next();
                    return;
                    
                } catch (error) {
                    console.error('❌ Error al obtener plan gratuito:', error);
                    return res.status(500).json({
                        success: false,
                        message: 'Error al obtener el plan gratuito'
                    });
                }
            }
            
            // Verificar si el plan tiene el módulo requerido
            const hasModule = plan.modules?.some(module => 
                module.name.toLowerCase() === moduleName.toLowerCase()
            );
            
            if (!hasModule) {
                console.log('❌ moduleAuth - Módulo no incluido en el plan');
                return res.status(403).json({
                    success: false,
                    message: `El plan actual de la empresa (${plan.name}) no incluye acceso al módulo "${moduleName}". Actualiza el plan para acceder a esta función.`,
                    code: 'MODULE_NOT_INCLUDED',
                    currentPlan: plan.name,
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
