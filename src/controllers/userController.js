const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');
const CloudinaryService = require('../services/cloudinaryService');

// Clase para errores controlados dentro del controlador
class ControllerError extends Error {
  constructor(message, status = 400, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

class UserController {

  // Helper centralizado para manejar peticiones, logs y respuestas
  static async _handleRequest(res, actionName, handlerFn, options = {}) {
    const {
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      const result = await handlerFn();
      
      let message = successMessage;
      let data = result;
      let status = successStatus;

      // Si el handlerFn retorna una estructura específica con control de respuesta
      if (result && typeof result === 'object' && result._customResponse) {
        message = result.message || message;
        data = result.data;
        status = result.status || status;
      }

      const responseBody = {
        success: true,
        message
      };
      if (data !== undefined) {
        responseBody.data = data;
      }

      return res.status(status).json(responseBody);
    } catch (error) {
      if (error instanceof ControllerError) {
        const responseBody = {
          success: false,
          message: error.message
        };
        if (error.data) {
          responseBody.data = error.data;
        }
        return res.status(error.status).json(responseBody);
      }
      console.error(`❌ Error en ${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Crear usuario
  static async createUser(req, res) {
    const { firstName, lastName, email, password, nameStore } = req.body;

    if (!firstName || !lastName || !email || !password || !nameStore) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, email, contraseña y nombre de empresa son requeridos'
      });
    }

    return UserController._handleRequest(res, 'createUser', async () => {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const newUser = await User.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        nameStore,
        is_active: true,
      });

      const tokenPayload = {
        id: newUser.id,
        empresa_id: newUser.empresa_id,
        type: 'user'
      };

      const token = generateToken(tokenPayload);

      return {
        user: {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          phone: newUser.phone,
          email: newUser.email,
          is_active: newUser.is_active
        },
        token: token
      };
    }, {
      successStatus: 201,
      successMessage: 'Usuario creado exitosamente'
    });
  }

  // Método para verificar si un email ya existe
  static async getUserByEmail(req, res) {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email es requerido'
      });
    }

    return UserController._handleRequest(res, 'getUserByEmail', async () => {
      const user = await User.getByEmail(email);
      return {
        _customResponse: true,
        message: user ? 'Email ya existe' : 'Email disponible',
        data: { exists: !!user }
      };
    });
  }

  // Método para login de usuario
  static async login(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    return UserController._handleRequest(res, 'loginUser', async () => {
      let user;
      try {
        user = await User.login(email, password);
      } catch (err) {
        if (err.message === 'INACTIVE_ACCOUNT') {
          throw new ControllerError('Su cuenta está inactiva. Contacte al administrador para reactivar su acceso.', 401);
        }
        throw err;
      }

      if (!user) {
        // Intentar como empleado si falla como usuario normal
        const Personal = require('../main/personal/Personal');
        const employeeResult = await Personal.loginEmployee(email, password);

        if (employeeResult.success) {
          return {
            _customResponse: true,
            success: true,
            message: 'Login exitoso',
            data: employeeResult.data
          };
        } else if (employeeResult.message === 'No tiene contraseña establecida') {
          // Obtener los datos del empleado para poder mandarlos al frontend
          const personal = await Personal.getByEmail(email);
          throw new ControllerError(employeeResult.message, 401, { personal });
        } else if (employeeResult.message && employeeResult.message.includes('inactiva')) {
          throw new ControllerError(employeeResult.message, 401);
        }

        // Si falla ambos, enviamos error genérico de usuario
        throw new ControllerError('Contraseña o correo electrónico incorrecto. Verifica los datos e intenta nuevamente.', 401);
      }

      const tokenPayload = {
        id: user.id,
        empresa_id: user.empresa_id,
        type: 'user'
      };

      const token = generateToken(tokenPayload);
      const fullUser = await User.getById(user.id);

      return {
        user: {
          id: fullUser.id,
          firstName: fullUser.firstName,
          lastName: fullUser.lastName,
          phone: fullUser.phone,
          email: fullUser.email,
          is_active: fullUser.is_active,
          modules: fullUser.modules,
          empresa_id: fullUser.empresa_id,
          empresa: fullUser.empresa,
          logo_tipo: fullUser.logo_tipo,
          empresa_tipo: fullUser.empresa?.tipo || null
        },
        token: token
      };
    }, {
      successMessage: 'Login exitoso'
    });
  }

  // Método para obtener información del usuario logueado
  static async getCurrentUser(req, res) {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID del usuario es requerido'
      });
    }

    return UserController._handleRequest(res, 'getCurrentUser', async () => {
      const user = await User.getById(id);

      if (!user) {
        throw new ControllerError('Usuario no encontrado', 404);
      }

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
          is_active: user.is_active,
          modules: user.modules,
          empresa_id: user.empresa_id,
          empresa: user.empresa,
          logo_tipo: user.logo_tipo,
          empresa_tipo: user.empresa?.tipo || null
        }
      };
    }, {
      successMessage: 'Usuario obtenido exitosamente'
    });
  }

  // Método para verificar contraseña actual
  static async verifyCurrentPassword(req, res) {
    const { userId, currentPassword } = req.body;

    if (!userId || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario y contraseña actual son requeridos'
      });
    }

    return UserController._handleRequest(res, 'verifyCurrentPassword', async () => {
      const isPasswordValid = await User.verifyPassword(userId, currentPassword);
      return {
        _customResponse: true,
        message: isPasswordValid ? 'Contraseña correcta' : 'Contraseña incorrecta',
        data: { isValid: isPasswordValid }
      };
    });
  }

  // Método para cambiar contraseña
  static async changePassword(req, res) {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario, contraseña actual y nueva contraseña son requeridos'
      });
    }

    return UserController._handleRequest(res, 'changePassword', async () => {
      const isCurrentPasswordValid = await User.verifyPassword(userId, currentPassword);
      
      if (!isCurrentPasswordValid) {
        throw new ControllerError('La contraseña actual es incorrecta', 400);
      }

      const updatedUser = await User.changePassword(userId, newPassword);

      return {
        user: {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
          phone: updatedUser.phone,
          is_active: updatedUser.is_active
        }
      };
    }, {
      successMessage: 'Contraseña cambiada exitosamente'
    });
  }

  // Método para actualizar la configuración (usuario y empresa)
  static async updateConfig(req, res) {
    const { userId, empresaId, userData, empresaData, logoBase64, removeLogo } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'El ID de usuario es requerido'
      });
    }

    return UserController._handleRequest(res, 'updateConfig', async () => {
      let finalEmpresaData = { ...empresaData };

      // Si se envía una nueva imagen en base64
      if (logoBase64) {
        const uploadResult = await CloudinaryService.uploadImage(logoBase64, 'TotalProd');
        if (uploadResult.success) {
          finalEmpresaData.logo_tipo = uploadResult.data.secure_url;
        } else {
          throw new ControllerError('Error al subir el logo a Cloudinary', 500);
        }
      } else if (removeLogo === true || removeLogo === 'true') {
        finalEmpresaData.logo_tipo = null;
      }

      const result = await User.updateConfig(userId, empresaId, userData, finalEmpresaData);

      // Refresh full user to return complete updated state
      const fullUser = await User.getById(userId);

      return {
        _customResponse: true,
        message: 'Configuración actualizada exitosamente',
        data: {
          user: {
            id: fullUser.id,
            firstName: fullUser.firstName,
            lastName: fullUser.lastName,
            phone: fullUser.phone,
            email: fullUser.email,
            is_active: fullUser.is_active,
            modules: fullUser.modules,
            empresa_id: fullUser.empresa_id,
            empresa: fullUser.empresa,
            logo_tipo: fullUser.logo_tipo,
            empresa_tipo: fullUser.empresa?.tipo || null
          }
        }
      };
    });
  }
}

module.exports = UserController;
