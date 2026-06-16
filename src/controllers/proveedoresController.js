const proveedor = require('../models/proveedores');
const { checkDeletePermission, checkUpdatePermission } = require('../utils/permissionsHelper');

class proveedoresController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateSucuId = false,
      validateProveedorId = false,
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

      if (validateProveedorId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'ID del proveedor es requerido'
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
              message: `No tienes permisos para ${checkPermission === 'delete' ? 'eliminar' : 'editar'} proveedores`
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

  // Obtener todos los proveedores de una sucursal
  static async getAll(req, res) {
    return proveedoresController._handleRequest(res, 'getAll', req, async () => {
      const sucuId = req.query.sucu_id;
      return await proveedor.getAll(sucuId);
    }, {
      validateSucuId: true,
      successMessage: 'Proveedores obtenidos exitosamente'
    });
  }

  // Crear un proveedor
  static async create(req, res) {
    const { name, phone, direccion, description, location, sucu_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return proveedoresController._handleRequest(res, 'create', req, async () => {
      return await proveedor.create({
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        location: location || null
      }, sucu_id);
    }, {
      validateSucuId: true,
      successStatus: 201,
      successMessage: 'Proveedor creado exitosamente'
    });
  }

  // Eliminar un proveedor
  static async delete(req, res) {
    return proveedoresController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await proveedor.delete(id);
    }, {
      validateProveedorId: true,
      checkPermission: 'delete',
      successMessage: 'Proveedor eliminado exitosamente'
    });
  }

  // Actualizar un proveedor
  static async update(req, res) {
    const { name, phone, direccion, description, location } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return proveedoresController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      return await proveedor.update(id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        location: location || null
      });
    }, {
      validateProveedorId: true,
      checkPermission: 'update',
      successMessage: 'Proveedor actualizado exitosamente'
    });
  }

  // Obtener un proveedor por ID
  static async getById(req, res) {
    return proveedoresController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      return await proveedor.getById(id);
    }, {
      validateProveedorId: true,
      successMessage: 'Proveedor obtenido exitosamente'
    });
  }
}

module.exports = proveedoresController;
