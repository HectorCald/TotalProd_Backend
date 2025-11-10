const gastos = require('../models/gastos');
const { checkDeletePermission, checkUpdatePermission, checkInfoPermission } = require('../utils/permissionsHelper');

class gastosController {

  // Obtener todos los gastos con paginación
  static async getAll(req, res) {
    try {
      const { page = 1, limit = 30, search = '', metodo_pago = null, proveedor_id = null, ordenamiento = 'fecha_desc', sucu_id } = req.query;
      
      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const result = await gastos.getAll(
        parseInt(page), 
        parseInt(limit, 10), 
        search,
        metodo_pago,
        proveedor_id,
        ordenamiento, 
        sucu_id
      );
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getAll gastos:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los gastos'
      });
    }
  }

  // Obtener todos los gastos sin límite (para reportes)
  static async getAllSinLimite(req, res) {
    try {
      const { ordenamiento = 'fecha_gasto_desc', sucu_id } = req.query;
      
      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const result = await gastos.getAllSinLimite(ordenamiento, sucu_id);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getAllSinLimite gastos:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los gastos'
      });
    }
  }

  // Obtener un gasto por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const { empresa_id } = req.query;
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del gasto es requerido'
        });
      }

      // Verificar permisos de información solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token
        
        const hasPermission = await checkInfoPermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para ver información de gastos'
          });
        }
      }

      // El empresa_id se usa por el middleware requireModuleAccess para verificar permisos
      // No es necesario pasarlo al modelo, solo validar que existe si se requiere
      
      const result = await gastos.getById(id);
      
      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getById gasto:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener el gasto'
      });
    }
  }

  // Crear un nuevo gasto
  static async create(req, res) {
    try {
      const { sucu_id, personal_id, fecha_gasto, valor, concepto, metodo_pago, proveedor_id } = req.body;
      const user_id = req.user?.id;
      const userType = req.user?.type; // Verificar si es empleado o usuario normal

      // Si es empleado, usar personal_id, si es usuario normal, usar user_id
      const finalUserId = userType === 'employee' ? null : user_id;
      const finalPersonalId = userType === 'employee' ? personal_id : null;

      if (!finalUserId && !finalPersonalId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Validaciones básicas
      if (!valor || valor <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El valor es obligatorio y debe ser mayor a 0'
        });
      }

      if (!concepto || !concepto.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El concepto es obligatorio'
        });
      }

      if (!metodo_pago || !metodo_pago.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El método de pago es obligatorio'
        });
      }

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const gastoData = {
        user_id: finalUserId,
        personal_id: finalPersonalId,
        sucu_id,
        fecha_gasto,
        valor: parseFloat(valor),
        concepto: concepto.trim(),
        metodo_pago: metodo_pago.trim(),
        proveedor_id: proveedor_id || null
      };

      const result = await gastos.create(gastoData);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error en create gasto:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al crear el gasto'
      });
    }
  }

  // Actualizar un gasto
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { fecha_gasto, valor, concepto, metodo_pago, proveedor_id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del gasto es requerido'
        });
      }

      // Validaciones básicas
      if (valor !== undefined && valor <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El valor debe ser mayor a 0'
        });
      }

      if (concepto !== undefined && !concepto.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El concepto es obligatorio'
        });
      }

      if (metodo_pago !== undefined && !metodo_pago.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El método de pago es obligatorio'
        });
      }

      const updateData = {
        fecha_gasto,
        valor: valor ? parseFloat(valor) : undefined,
        concepto: concepto ? concepto.trim() : undefined,
        metodo_pago: metodo_pago ? metodo_pago.trim() : undefined,
        proveedor_id: proveedor_id || null
      };

      // Verificar si el gasto está asociado a algún movimiento
      const gastoAsociado = await gastos.isAssociatedWithMovement(id);
      if (gastoAsociado) {
        return res.status(400).json({
          success: false,
          message: 'No se puede editar un gasto asociado a un movimiento de acopio'
        });
      }

      // Verificar permisos de actualización solo si es empleado
      const userType = req.user?.type;
      
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token
        
        const hasPermission = await checkUpdatePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para actualizar gastos'
          });
        }
      }

      const result = await gastos.update(id, updateData);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en update gasto:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar el gasto'
      });
    }
  }

  // Eliminar un gasto
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del gasto es requerido'
        });
      }

      // Verificar si el gasto está asociado a algún movimiento
      const gastoAsociado = await gastos.isAssociatedWithMovement(id);
      if (gastoAsociado) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar este gasto porque está asociado a un movimiento. Anule/elimine el movimiento primero.'
        });
      }

      // Verificar permisos de eliminación solo si es empleado
      const userType = req.user?.type;
      
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token
        
        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar gastos'
          });
        }
      }

      const result = await gastos.delete(id);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en delete gasto:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al eliminar el gasto'
      });
    }
  }

  // Obtener gastos por rango de fechas
  static async getByDateRange(req, res) {
    try {
      const { fechaInicio, fechaFin, sucu_id } = req.query;
      const { sucu_id: userSucuId } = req.user;

      const sucuId = sucu_id || userSucuId;
      
      if (!sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          message: 'Las fechas de inicio y fin son requeridas'
        });
      }

      const result = await gastos.getByDateRange(fechaInicio, fechaFin, sucuId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getByDateRange gastos:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener los gastos'
      });
    }
  }
}

module.exports = gastosController;
