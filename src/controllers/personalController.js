const Personal = require('../models/Personal');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

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
        const empresaId = req.query.empresa_id || req.body.empresa_id;
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
      const empresaId = req.query.empresa_id;
      return await Personal.getAll(empresaId);
    }, {
      validateEmpresaId: true,
      successMessage: 'Personal obtenido exitosamente'
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

  // Crear personal
  static async create(req, res) {
    return PersonalController._handleRequest(res, 'create', req, async () => {
      const { first_name, last_name, email, cargo, cargo_id, sucursal_id, permisos = {}, ubicacion = null, rastrear = false } = req.body;
      const empresaId = req.body.empresa_id;

      if (!first_name || !last_name || !email || (!cargo && !cargo_id)) {
        return { success: false, message: 'Nombre, apellido, correo y cargo son requeridos' };
      }

      const personalData = {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email,
        cargo,
        cargo_id,
        empresa_id: empresaId,
        sucursal_id: sucursal_id || null,
        ubicacion,
        rastrear,
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
      const { first_name, last_name, email, cargo, cargo_id, is_active, sucursal_id, permisos, ubicacion, rastrear } = req.body;

      const personalData = {};
      if (first_name) personalData.first_name = first_name.trim();
      if (last_name) personalData.last_name = last_name.trim();
      if (email) personalData.email = email;
      if (cargo !== undefined) personalData.cargo = cargo;
      if (cargo_id !== undefined) personalData.cargo_id = cargo_id;
      if (is_active !== undefined) personalData.is_active = is_active;
      if (sucursal_id !== undefined) personalData.sucursal_id = sucursal_id;
      if (ubicacion !== undefined) personalData.ubicacion = ubicacion;
      if (rastrear !== undefined) personalData.rastrear = rastrear;
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

  // Validar correo de empleado
  static async validateEmployeeEmail(req, res) {
    return PersonalController._handleRequest(res, 'validateEmployeeEmail', req, async () => {
      const { email } = req.params;

      if (!email) {
        return { success: false, message: 'Correo es requerido' };
      }

      const personal = await Personal.getByEmail(email);

      if (!personal) {
        return { success: false, status: 404, message: 'Correo de empleado no válido' };
      }

      if (personal.password && !personal.is_active) {
        return { success: false, status: 403, message: 'Cuenta inactiva' };
      }

      return {
        success: true,
        message: 'Correo válido',
        data: {
          personal: personal,
          hasPassword: !!personal.password
        }
      };
    }, {
      validateEmpresaId: false
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

  // Login de empleado
  static async loginEmployee(req, res) {
    return PersonalController._handleRequest(res, 'loginEmployee', req, async () => {
      const { email, password } = req.body;

      if (!email || !password) {
        return { success: false, message: 'Correo y contraseña son requeridos' };
      }

      const result = await Personal.loginEmployee(email, password);

      if (!result.success) {
        return { success: false, status: 401, message: result.message };
      }

      return {
        success: true,
        message: 'Login exitoso',
        data: result.data
      };
    });
  }

  // Cambiar contraseña de empleado
  static async changePassword(req, res) {
    return PersonalController._handleRequest(res, 'changePassword', req, async () => {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return { success: false, message: 'Contraseña actual y nueva contraseña son requeridos' };
      }

      if (newPassword.length < 8) {
        return { success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' };
      }

      const result = await Personal.changePassword(id, currentPassword, newPassword);
      return result; // Result ya tiene success, message
    }, {
      validatePersonalId: true
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

  // Actualizar ubicación del empleado
  static async updateLocation(req, res) {
    return PersonalController._handleRequest(res, 'updateLocation', req, async () => {
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return { success: false, message: 'Latitud y longitud son requeridos' };
      }

      const result = await Personal.updateLocation(id, latitude, longitude);
      return result;
    }, {
      validatePersonalId: true
    });
  }

  // Obtener ubicación del empleado
  static async getLocation(req, res) {
    return PersonalController._handleRequest(res, 'getLocation', req, async () => {
      const { id } = req.params;
      const result = await Personal.getLocation(id);
      return result;
    }, {
      validatePersonalId: true
    });
  }
}

module.exports = PersonalController;
