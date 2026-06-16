const client = require('../models/clients');
const { checkDeletePermission, checkUpdatePermission } = require('../utils/permissionsHelper');

class clientsController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateSucuId = false,
      validateClientId = false,
      checkPermission = null,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      if (validateSucuId) {
        const sucuId = req.query.sucu_id || req.body.sucu_id;
        if (!sucuId) {
          return res.status(400).json({
            success: false,
            message: 'ID de la sucursal es requerido'
          });
        }
      }

      if (validateClientId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'ID del cliente es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
          } else if (checkPermission === 'update') {
            hasPermission = await checkUpdatePermission(personal_id);
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para ${checkPermission === 'delete' ? 'eliminar' : 'editar'} clientes`
            });
          }
        }
      }

      const data = await handlerFn();
      
      const responseBody = {
        success: true,
        message: successMessage
      };
      if (data !== undefined) {
        responseBody.data = data;
      }

      return res.status(successStatus).json(responseBody);
    } catch (error) {
      console.error(`Error en ${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los clientes de una sucursal
  static async getAll(req, res) {
    return clientsController._handleRequest(res, 'getAll', req, async () => {
      const sucuId = req.query.sucu_id;
      return await client.getAll(sucuId);
    }, {
      validateSucuId: true,
      successMessage: 'Clientes obtenidos exitosamente'
    });
  }

  // Crear un cliente
  static async create(req, res) {
    const { name, phone, direccion, description, total_orders, location, sucu_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return clientsController._handleRequest(res, 'create', req, async () => {
      return await client.create({
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        total_orders: total_orders || 0,
        location: location || null
      }, sucu_id);
    }, {
      validateSucuId: true,
      successStatus: 201,
      successMessage: 'Cliente creado exitosamente'
    });
  }

  // Eliminar un cliente
  static async delete(req, res) {
    return clientsController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await client.delete(id);
    }, {
      validateClientId: true,
      checkPermission: 'delete',
      successMessage: 'Cliente eliminado exitosamente'
    });
  }

  // Actualizar un cliente
  static async update(req, res) {
    const { name, phone, direccion, description, total_orders, location } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return clientsController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      return await client.update(id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        total_orders: total_orders || 0,
        location: location || null
      });
    }, {
      validateClientId: true,
      checkPermission: 'update',
      successMessage: 'Cliente actualizado exitosamente'
    });
  }

  // Obtener un cliente por ID
  static async getById(req, res) {
    return clientsController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      return await client.getById(id);
    }, {
      validateClientId: true,
      successMessage: 'Cliente obtenido exitosamente'
    });
  }

  // Obtener ubicación del cliente (tabla clients o último movimiento con ubicación)
  static async getLocation(req, res) {
    return clientsController._handleRequest(res, 'getLocation', req, async () => {
      const { id } = req.params;
      return await client.getLocation(id);
    }, {
      validateClientId: true,
      successMessage: 'Ubicación obtenida'
    });
  }
}

module.exports = clientsController;