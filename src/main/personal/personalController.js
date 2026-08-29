const Personal = require('./Personal');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../../utils/permissionsHelper');

class PersonalController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validatePersonalId = false,
      checkPermission = null,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      if (validateEmpresaId) {
        const empresaId = req.query.company_id || req.query.empresa_id || req.body.company_id || req.body.empresa_id;
        if (!empresaId) {
          return res.status(400).json({
            success: false,
            message: 'El ID de la empresa es requerido'
          });
        }
      }

      if (validatePersonalId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID del personal es requerido'
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
              message: `No tienes permisos para ${actionTranslate[checkPermission]} personal`
            });
          }
        }
      }

      const data = await handlerFn();
      
      const responseBody = {
        success: true,
        message: successMessage
      };
      
      // Manejar casos donde handlerFn devuelve un objeto { success, message, data, status } directamente
      if (data && typeof data === 'object' && 'success' in data) {
          if (!data.success) {
              return res.status(data.status || 400).json({
                  success: false,
                  message: data.message
              });
          }
          responseBody.message = data.message || successMessage;
          if (data.data !== undefined) responseBody.data = data.data;
          return res.status(data.status || successStatus).json(responseBody);
      }

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

  // Obtener todos los personal de una empresa
  static async getAll(req, res) {
    return PersonalController._handleRequest(res, 'getAll', req, async () => {
      const empresaId = req.query.company_id || req.query.empresa_id;
      return await Personal.getAll(empresaId);
    }, {
      validateEmpresaId: true,
      successMessage: 'Personal obtenido exitosamente'
    });
  }

  // Crear personal
  static async create(req, res) {
    return PersonalController._handleRequest(res, 'create', req, async () => {
      const { first_name, last_name, email, phone, position_id, cargo_id, sucursal_id, branch_id, permisos = {} } = req.body;
      const empresaId = req.body.company_id || req.body.empresa_id;

      if (!first_name || !last_name || !email) {
        return { success: false, message: 'Nombre, apellido y correo son requeridos' };
      }

      const personalData = {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : null,
        position_id: position_id || cargo_id || null,
        cargo_id: position_id || cargo_id || null,
        company_id: empresaId,
        empresa_id: empresaId,
        branch_id: branch_id || sucursal_id || null,
        sucursal_id: branch_id || sucursal_id || null,
        permisos
      };

      return await Personal.create(personalData);
    }, {
      validateEmpresaId: true,
      checkPermission: 'create',
      successStatus: 201,
      successMessage: 'Personal creado exitosamente'
    });
  }

  // Actualizar personal
  static async update(req, res) {
    return PersonalController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      const { first_name, last_name, email, phone, position_id, cargo_id, is_active, branch_id, sucursal_id, permisos } = req.body;

      const personalData = {};
      if (first_name) personalData.first_name = first_name.trim();
      if (last_name) personalData.last_name = last_name.trim();
      if (email) personalData.email = email.trim();
      if (phone !== undefined) personalData.phone = phone;
      if (position_id !== undefined || cargo_id !== undefined) {
        personalData.position_id = position_id !== undefined ? position_id : cargo_id;
        personalData.cargo_id = personalData.position_id;
      }
      if (is_active !== undefined) personalData.is_active = is_active;
      if (branch_id !== undefined || sucursal_id !== undefined) {
        personalData.branch_id = branch_id !== undefined ? branch_id : sucursal_id;
        personalData.sucursal_id = personalData.branch_id;
      }
      if (permisos !== undefined) personalData.permisos = permisos;

      return await Personal.update(id, personalData);
    }, {
      validatePersonalId: true,
      checkPermission: 'update',
      successMessage: 'Personal actualizado exitosamente'
    });
  }

  // Eliminar personal
  static async delete(req, res) {
    return PersonalController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await Personal.delete(id);
    }, {
      validatePersonalId: true,
      checkPermission: 'delete',
      successMessage: 'Personal eliminado exitosamente'
    });
  }

  // Obtener personal por ID
  static async getById(req, res) {
    return PersonalController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      const personal = await Personal.getById(id);
      if (!personal) {
        return { success: false, status: 404, message: 'Personal no encontrado' };
      }
      return personal;
    }, {
      validatePersonalId: true,
      successMessage: 'Personal obtenido exitosamente'
    });
  }

  // Establecer contraseña para empleado
  static async setPassword(req, res) {
    return PersonalController._handleRequest(res, 'setPassword', req, async () => {
      const { id } = req.params;
      const { password } = req.body;

      if (!password) {
        return { success: false, message: 'Contraseña es requerida' };
      }

      if (password.length < 8) {
        return { success: false, message: 'La contraseña debe tener al menos 8 caracteres' };
      }

      return await Personal.setPassword(id, password);
    }, {
      validatePersonalId: true,
      successMessage: 'Contraseña establecida exitosamente'
    });
  }

  // Resetear contraseña de empleado
  static async resetPassword(req, res) {
    return PersonalController._handleRequest(res, 'resetPassword', req, async () => {
      const { id } = req.params;
      const result = await Personal.resetPassword(id);
      return result;
    }, {
      validatePersonalId: true
    });
  }

}

module.exports = PersonalController;