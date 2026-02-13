const proveedor = require('../models/proveedores');
const { checkDeletePermission, checkUpdatePermission } = require('../utils/permissionsHelper');

class proveedoresController {

  // Obtener todos los proveedores de una sucursal
  static async getAll(req, res) {
    try {
      // Obtener el sucu_id de la query
      const sucuId = req.query.sucu_id;
      
      if (!sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const proveedores = await proveedor.getAll(sucuId);
      
      res.status(200).json({
        success: true,
        message: 'Proveedores obtenidos exitosamente',
        data: proveedores
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Crear un proveedor
  static async create(req, res) {
    try {
      const { name, phone, direccion, description, location, sucu_id } = req.body;

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      // Crear el proveedor
      const newProveedor = await proveedor.create({
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        location: location || null
      }, sucu_id);

      res.status(201).json({
        success: true,
        message: 'Proveedor creado exitosamente',
        data: newProveedor
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Eliminar un proveedor
  static async delete(req, res) {
    try {
      const { id } = req.params;
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del proveedor es requerido'
        });
      }

      // Verificar permisos de eliminación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar proveedores'
          });
        }
      }

      // Eliminar el proveedor
      await proveedor.delete(id);

      res.status(200).json({
        success: true,
        message: 'Proveedor eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error en delete:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Actualizar un proveedor
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, direccion, description, location } = req.body;
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del proveedor es requerido'
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
            message: 'No tienes permisos para editar proveedores'
          });
        }
      }

      // Actualizar el proveedor
      const updatedProveedor = await proveedor.update(id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        location: location || null
      });

      res.status(200).json({
        success: true,
        message: 'Proveedor actualizado exitosamente',
        data: updatedProveedor
      });
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener un proveedor por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del proveedor es requerido'
        });
      }

      const proveedorData = await proveedor.getById(id);

      res.status(200).json({
        success: true,
        message: 'Proveedor obtenido exitosamente',
        data: proveedorData
      });
    } catch (error) {
      console.error('Error en getById:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = proveedoresController;
