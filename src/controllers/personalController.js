const Personal = require('../models/Personal');

class PersonalController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validatePersonalId = false,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      if (validateEmpresaId) {
        const empresaId = req.query.empresa_id || req.body.empresa_id;
        if (!empresaId) {
          return res.status(400).json({
            success: false,
            message: 'ID de la empresa es requerido'
          });
        }
      }

      if (validatePersonalId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'ID del personal es requerido'
          });
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
        message: error.message || 'Error interno del servidor'
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
      const { first_name, last_name, codigo, cargo, cargo_id, sucursal_id, permisos = {}, ubicacion = null, rastrear = false } = req.body;
      const empresaId = req.body.empresa_id;

      if (!first_name || !last_name || !codigo || (!cargo && !cargo_id)) {
        return { success: false, message: 'Nombre, apellido, código y cargo son requeridos' };
      }



      const personalData = {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        codigo,
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
      successStatus: 201,
      successMessage: 'Personal creado exitosamente'
    });
  }

  // Actualizar personal
  static async update(req, res) {
    return PersonalController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      const { first_name, last_name, codigo, cargo, cargo_id, is_active, sucursal_id, permisos, ubicacion, rastrear } = req.body;



      const personalData = {};
      if (first_name) personalData.first_name = first_name.trim();
      if (last_name) personalData.last_name = last_name.trim();
      if (codigo) personalData.codigo = codigo;
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
      successMessage: 'Personal eliminado exitosamente'
    });
  }

  // Validar código de empleado
  static async validateEmployeeCode(req, res) {
    return PersonalController._handleRequest(res, 'validateEmployeeCode', req, async () => {
      const { codigo } = req.params;

      if (!codigo) {
        return { success: false, message: 'Código es requerido' };
      }

      const personal = await Personal.getByCodigo(codigo);

      if (!personal) {
        return { success: false, status: 404, message: 'Código de empleado no válido' };
      }

      if (personal.password && !personal.is_active) {
        return { success: false, status: 403, message: 'Su cuenta está inactiva. Contacte al administrador.' };
      }

      return {
        success: true,
        message: 'Código válido',
        data: {
          personal: personal,
          hasPassword: !!personal.password
        }
      };
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
      const { codigo, password } = req.body;

      if (!codigo || !password) {
        return { success: false, message: 'Código y contraseña son requeridos' };
      }

      const result = await Personal.loginEmployee(codigo, password);

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
