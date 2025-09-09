const proveedor = require('../models/proveedores');

class proveedoresController {

  // Obtener todos los clientes
  static async getAll(req, res) {
    try {
      // Obtener el userId del usuario autenticado
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Parámetros de paginación y búsqueda
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const offset = (page - 1) * limit;

      const result = await proveedor.getAllPaginated(userId, { page, limit, offset, search });
      
      res.status(200).json({
        success: true,
        message: 'Proveedores obtenidos exitosamente',
        data: result.proveedores,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(result.total / limit),
          totalItems: result.total,
          hasNextPage: page < Math.ceil(result.total / limit),
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Crear un cliente
  static async create(req, res) {
    try {
      const { name, phone, direccion, location } = req.body;

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      // Crear el proveedor
      const newProveedor = await proveedor.create({
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        location: location || null
      }, req.user.id);

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

  // Eliminar un cliente
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del proveedor es requerido'
        });
      }

      // Eliminar el cliente
      await proveedor.delete(id, req.user.id);

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

  // Actualizar un cliente
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, direccion, location } = req.body;

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

      // Actualizar el proveedor
      const updatedProveedor = await proveedor.update(id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        location: location || null
      }, req.user.id);

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
}

module.exports = proveedoresController;
