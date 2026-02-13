const client = require('../models/clients');
const { checkDeletePermission, checkUpdatePermission } = require('../utils/permissionsHelper');

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

      const clients = await client.getAll(sucuId);
      
      res.status(200).json({
        success: true,
        message: 'Clientes obtenidos exitosamente',
        data: clients
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
      const { name, phone, direccion, description, total_orders, location, sucu_id } = req.body;

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
        total_orders: total_orders || 0,
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
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del cliente es requerido'
        });
      }

      // Verificar permisos de eliminación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar clientes'
          });
        }
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
      const { name, phone, direccion, description, total_orders, location } = req.body;
      const userType = req.user?.type;

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

      // Verificar permisos de edición solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkUpdatePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para editar clientes'
          });
        }
      }

      // Actualizar el cliente
      const updatedClient = await client.update(id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        total_orders: total_orders || 0,
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

  // Obtener un cliente por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del cliente es requerido'
        });
      }

      const clientData = await client.getById(id);

      res.status(200).json({
        success: true,
        message: 'Cliente obtenido exitosamente',
        data: clientData
      });
    } catch (error) {
      console.error('Error en getById:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener ubicación del cliente (tabla clients o último movimiento con ubicación)
  static async getLocation(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del cliente es requerido'
        });
      }

      const result = await client.getLocation(id);

      res.status(200).json({
        success: true,
        message: 'Ubicación obtenida',
        data: result
      });
    } catch (error) {
      console.error('Error en getLocation:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = clientsController;
