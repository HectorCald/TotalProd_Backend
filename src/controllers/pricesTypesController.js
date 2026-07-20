const pricesTypes = require('../models/pricesTypes');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class pricesTypesController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validatePriceTypeId = false,
      checkPermission = null,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      if (validateEmpresaId) {
        const empresaId = req.query.empresa_id || req.body.empresa_id;
        if (!empresaId) {
          return res.status(400).json({
            success: false,
            message: 'El ID de la empresa es requerido'
          });
        }
      }

      if (validatePriceTypeId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID del tipo de precio es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'create') {
            hasPermission = await checkCreatePermission(personal_id);
          } else if (checkPermission === 'update') {
            hasPermission = await checkUpdatePermission(personal_id);
          } else if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
          }
          if (!hasPermission) {
            const actionTranslate = { create: 'crear', update: 'editar', delete: 'eliminar' };
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para ${actionTranslate[checkPermission]} tipos de precios`
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
        message: 'Ocurrió un error inesperado'
      });
    }
  }

  // Obtener todos los tipos de precios
  static async getAll(req, res) {
    return pricesTypesController._handleRequest(res, 'getAll', req, async () => {
      const empresaId = req.query.empresa_id;
      
      let empresasAsociadasIds = [];
      if (req.query.empresas_asociadas) {
        const asociadas = Array.isArray(req.query.empresas_asociadas) 
          ? req.query.empresas_asociadas 
          : [req.query.empresas_asociadas];
        empresasAsociadasIds = asociadas.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '');
      }

      if (req.user?.type === 'employee') {
        const sucursalId = req.query.sucursal_id;
        if (sucursalId) {
          try {
            const Sucursal = require('../models/sucursales');
            const sucursal = await Sucursal.getById(sucursalId);
            if (sucursal && sucursal.name && !sucursal.name.includes('Casa Matriz')) {
              return await pricesTypes.getBySucursalId(sucursalId);
            }
            // Si es Casa Matriz, pasa al getAll normal
          } catch (error) {
            console.error('Error al verificar sucursal Casa Matriz', error);
            return await pricesTypes.getBySucursalId(sucursalId);
          }
        }
      }
      
      return await pricesTypes.getAll(empresaId, empresasAsociadasIds);
    }, {
      validateEmpresaId: true,
      successMessage: 'Tipos de precios obtenidos exitosamente'
    });
  }

  // Crear un tipo de precio
  static async create(req, res) {
    const { name, description, empresa_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return pricesTypesController._handleRequest(res, 'create', req, async () => {
      return await pricesTypes.create({
        name: name.trim(),
        description: description ? description.trim() : null
      }, empresa_id);
    }, {
      validateEmpresaId: true,
      checkPermission: 'create',
      successStatus: 201,
      successMessage: 'Tipo de precio creado exitosamente'
    });
  }

  // Actualizar un tipo de precio
  static async update(req, res) {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return pricesTypesController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      return await pricesTypes.update(id, {
        name: name.trim(),
        description: description ? description.trim() : null
      });
    }, {
      validatePriceTypeId: true,
      checkPermission: 'update',
      successMessage: 'Tipo de precio actualizado exitosamente'
    });
  }

  // Eliminar un tipo de precio
  static async delete(req, res) {
    return pricesTypesController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await pricesTypes.delete(id);
    }, {
      validatePriceTypeId: true,
      checkPermission: 'delete',
      successMessage: 'Tipo de precio eliminado exitosamente'
    });
  }
}

module.exports = pricesTypesController;
