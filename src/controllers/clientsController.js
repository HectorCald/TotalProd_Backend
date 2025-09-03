const client = require('../models/clients');

class clientsController {
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

      const clients = await client.getAll(userId);
      res.status(200).json({
        success: true,
        message: 'Clientes obtenidos exitosamente',
        data: clients
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async create(req, res) {
    try {
      const { name, phone, direccion, location } = req.body;

      console.log('🔍 CREATE - Datos recibidos:', req.body);
      console.log('🔍 CREATE - location:', location);

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      // Crear el cliente
      const newClient = await client.create({
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        location: location || null
      }, req.user.id);

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
      await client.delete(id, req.user.id);

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

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, phone, direccion, location } = req.body;

      console.log('🔍 UPDATE - ID:', id);
      console.log('🔍 UPDATE - Datos recibidos:', req.body);
      console.log('🔍 UPDATE - location:', location);

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
        location: location || null
      }, req.user.id);

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
