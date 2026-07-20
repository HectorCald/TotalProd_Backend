const categoryAcopio = require('../models/categoryAcopio');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class categoryAcopioController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validateCategoryId = false,
      checkPermission = null,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      const empresaId = req.query.empresa_id || req.body.empresa_id;

      if (validateEmpresaId && !empresaId) {
        return res.status(400).json({
          success: false,
          message: 'El ID de la empresa es requerido'
        });
      }

      if (validateCategoryId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID de la categoría es requerido'
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
              message: `No tienes permisos para ${actionTranslate[checkPermission]} categorías`
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

      // Si es un error de validación (nombre duplicado), devolver 400
      if (error.message === 'Ya existe una categoría con este nombre') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Ocurrió un error inesperado'
      });
    }
  }

  // Obtener todas las categorías
  static async getAll(req, res) {
    return categoryAcopioController._handleRequest(res, 'getAll', req, async () => {
      const empresaId = req.query.empresa_id;
      return await categoryAcopio.getAll(empresaId);
    }, {
      validateEmpresaId: true,
      successMessage: 'Categorías obtenidas exitosamente'
    });
  }

  // Crear una categoría
  static async create(req, res) {
    const { name, empresa_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return categoryAcopioController._handleRequest(res, 'create', req, async () => {
      return await categoryAcopio.create({
        name: name.trim()
      }, empresa_id);
    }, {
      validateEmpresaId: true,
      checkPermission: 'create',
      successStatus: 201,
      successMessage: 'Categoría creada exitosamente'
    });
  }

  // Actualizar una categoría
  static async update(req, res) {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return categoryAcopioController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      return await categoryAcopio.update(id, {
        name: name.trim()
      });
    }, {
      validateCategoryId: true,
      checkPermission: 'update',
      successMessage: 'Categoría actualizada exitosamente'
    });
  }

  // Eliminar una categoría
  static async delete(req, res) {
    return categoryAcopioController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await categoryAcopio.delete(id);
    }, {
      validateCategoryId: true,
      checkPermission: 'delete',
      successMessage: 'Categoría eliminada exitosamente'
    });
  }
}

module.exports = categoryAcopioController;
