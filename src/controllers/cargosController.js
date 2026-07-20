const Cargos = require('../models/Cargos');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class cargosController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validateCargoId = false,
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
      if (validateCargoId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID del cargo es requerido'
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
              message: `No tienes permisos para ${actionTranslate[checkPermission]} cargos`
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

  // Obtener todos los cargos
  static async getAll(req, res) {
    return cargosController._handleRequest(res, 'getAll', req, async () => {
      const empresaId = req.query.empresa_id;
      return await Cargos.getAll(empresaId);
    }, {
      validateEmpresaId: true,
      successMessage: 'Cargos obtenidos exitosamente'
    });
  }

  // Crear un cargo
  static async create(req, res) {
    const { name, description, modules, empresa_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return cargosController._handleRequest(res, 'create', req, async () => {
      return await Cargos.create({
        name: name.trim(),
        description: description ? description.trim() : null,
        modules: modules || []
      }, empresa_id);
    }, {
      validateEmpresaId: true,
      checkPermission: 'create',
      successStatus: 201,
      successMessage: 'Cargo creado exitosamente'
    });
  }

  // Actualizar un cargo
  static async update(req, res) {
    const { name, description, modules } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return cargosController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      return await Cargos.update(id, {
        name: name.trim(),
        description: description ? description.trim() : null,
        modules: modules
      });
    }, {
      validateCargoId: true,
      checkPermission: 'update',
      successMessage: 'Cargo actualizado exitosamente'
    });
  }

  // Eliminar un cargo
  static async delete(req, res) {
    return cargosController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await Cargos.delete(id);
    }, {
      validateCargoId: true,
      checkPermission: 'delete',
      successMessage: 'Cargo eliminado exitosamente'
    });
  }
}

module.exports = cargosController;
