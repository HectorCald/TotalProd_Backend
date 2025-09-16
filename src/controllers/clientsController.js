const client = require('../models/clients');

class clientsController {

  // Obtener todos los clientes de una sucursal
  static async getAll(req, res) {
    try {
      // Obtener el sucu_id de la sucursal seleccionada
      const sucuId = req.query.sucu_id;
      
      if (!sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      // Parámetros de paginación y búsqueda
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const offset = (page - 1) * limit;

      const result = await client.getAll(sucuId, { page, limit, offset, search });
      
      res.status(200).json({
        success: true,
        message: 'Clientes obtenidos exitosamente',
        data: result.clients,
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

      // Crear el cliente
      const newClient = await client.create({
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        location: location || null
      }, sucu_id);

      res.status(201).json({
        success: true,
        message: 'Cliente creado exitosamente',
        data: newClient
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
          message: 'ID del cliente es requerido'
        });
      }

      // Eliminar el cliente
      await client.delete(id);

      res.status(200).json({
        success: true,
        message: 'Cliente eliminado exitosamente'
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
      const { name, phone, direccion, description, location } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del cliente es requerido'
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }


      // Actualizar el cliente
      const updatedClient = await client.update(id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        location: location || null
      });

      res.status(200).json({
        success: true,
        message: 'Cliente actualizado exitosamente',
        data: updatedClient
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

module.exports = clientsController;
