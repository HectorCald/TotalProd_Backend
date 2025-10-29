const pricesTypes = require('../models/pricesTypes');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class pricesTypesController {

  // Obtener todos los tipos de precios
  static async getAll(req, res) {
    try {
      const empresaId = req.query.empresa_id;
      const sucursalId = req.query.sucursal_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      let priceTypes;

      // Si se proporciona sucursal_id, verificar si es "Casa Matriz"
      if (sucursalId) {
        const sucursales = require('../models/sucursales');
        const sucursalResult = await sucursales.getById(sucursalId);
        
        if (sucursalResult.success && sucursalResult.data) {
          // Si es "Casa Matriz", cargar todos los precios normalmente
          if (sucursalResult.data.name === 'Casa Matriz') {
            priceTypes = await pricesTypes.getAll(empresaId);
          } else {
            // Si no es "Casa Matriz", cargar solo los precios asignados a esa sucursal
            priceTypes = await pricesTypes.getBySucursalId(sucursalId);
          }
        } else {
          // Si no se encuentra la sucursal, cargar todos los precios por defecto
          priceTypes = await pricesTypes.getAll(empresaId);
        }
      } else {
        // Si no se proporciona sucursal_id, cargar todos los precios normalmente
        priceTypes = await pricesTypes.getAll(empresaId);
      }
      
      res.status(200).json({
        success: true,
        message: 'Tipos de precios obtenidos exitosamente',
        data: priceTypes
      });
    } catch (error) {
      console.error('Error en pricesTypesController.getAll:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear un tipo de precio
  static async create(req, res) {
    try {
      const { name, description, empresa_id } = req.body;
      const userType = req.user?.type;

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      if (!empresa_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      // Verificar permisos de creación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkCreatePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear tipos de precios'
          });
        }
      }

      // Crear el tipo de precio
      const newPriceType = await pricesTypes.create({
        name: name.trim(),
        description: description ? description.trim() : null
      }, empresa_id);

      res.status(201).json({
        success: true,
        message: 'Tipo de precio creado exitosamente',
        data: newPriceType
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Actualizar un tipo de precio
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del tipo de precio es requerido'
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      // Verificar permisos de edición solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkUpdatePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para editar tipos de precios'
          });
        }
      }

      // Actualizar el tipo de precio
      const updatedPriceType = await pricesTypes.update(id, {
        name: name.trim(),
        description: description ? description.trim() : null
      });

      res.status(200).json({
        success: true,
        message: 'Tipo de precio actualizado exitosamente',
        data: updatedPriceType
      });
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Eliminar un tipo de precio
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del tipo de precio es requerido'
        });
      }

      // Verificar permisos de eliminación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar tipos de precios'
          });
        }
      }

      // Eliminar el tipo de precio
      await pricesTypes.delete(id);

      res.status(200).json({
        success: true,
        message: 'Tipo de precio eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error en delete:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = pricesTypesController;
