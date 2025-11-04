const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');

class UserController {
  static async createUser(req, res) {
    try {
      const { firstName, lastName, email, password, nameStore } = req.body;

      // Validar campos requeridos
      if (!firstName || !lastName || !email || !password || !nameStore) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, email, contraseña y nombre de empresa son requeridos'
        });
      }

      // Encriptar la contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Crear el usuario
      const newUser = await User.create({
        firstName: firstName,
        lastName: lastName,
        email: email,
        password: hashedPassword,
        nameStore: nameStore,
        is_active: true,
      });

      // Generar token JWT
      const tokenPayload = {
        id: newUser.id,
        empresa_id: newUser.empresa_id,
        type: 'user' // Identificar que es un usuario normal
      };

      const token = generateToken(tokenPayload);

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: {
          user: {
            id: newUser.id,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            phone: newUser.phone,
            email: newUser.email,
            is_active: newUser.is_active
          },
          token: token
        }
      });
    } catch (error) {
      console.error('Error en createUser:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para verificar si un celular ya existe
  static async getUserByEmail(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
            message: 'Email es requerido'
        });
      }

      const user = await User.getByEmail(email);

      if (user) {
        return res.status(200).json({
          success: true,
          message: 'Email ya existe',
          data: { exists: true }
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'Email disponible',
          data: { exists: false }
        });
      }
    } catch (error) {
      console.error('Error en getUserByEmail:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para login de usuario
  static async login(req, res) {
    try {
      
      const { email, password } = req.body;

      // Validar campos requeridos
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email y contraseña son requeridos'
        });
      }

      // Validar credenciales usando el modelo
      const user = await User.login(email, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Generar token JWT
      const tokenPayload = {
        id: user.id,
        empresa_id: user.empresa_id,
        type: 'user' // Identificar que es un usuario normal
      };

      const token = generateToken(tokenPayload);

      res.status(200).json({
        success: true,
        message: 'Login exitoso',
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            is_active: user.is_active
          },
          token: token
        }
      });
    } catch (error) {
      console.error('Error en loginUser:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para obtener información del usuario logueado
  static async getCurrentUser(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del usuario es requerido'
        });
      }

      const user = await User.getById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Usuario obtenido exitosamente',
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            email: user.email,
            is_active: user.is_active,
            plan_id: user.plan_id,
            plan: user.plan,
            modules: user.modules,
            empresa_id: user.empresa_id,
            empresa: user.empresa,
            logo_tipo: user.logo_tipo,
            empresa_tipo: user.empresa?.tipo || null
          }
        }
      });
    } catch (error) {
      console.error('Error en getCurrentUser:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para verificar contraseña actual
  static async verifyCurrentPassword(req, res) {
    try {
      const { userId, currentPassword } = req.body;

      if (!userId || !currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario y contraseña actual son requeridos'
        });
      }

      const isPasswordValid = await User.verifyPassword(userId, currentPassword);

      res.status(200).json({
        success: true,
        message: isPasswordValid ? 'Contraseña correcta' : 'Contraseña incorrecta',
        data: { isValid: isPasswordValid }
      });
    } catch (error) {
      console.error('Error en verifyCurrentPassword:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para cambiar contraseña
  static async changePassword(req, res) {
    try {
      const { userId, currentPassword, newPassword } = req.body;

      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario, contraseña actual y nueva contraseña son requeridos'
        });
      }

      // Verificar que la contraseña actual sea correcta
      const isCurrentPasswordValid = await User.verifyPassword(userId, currentPassword);
      
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña actual es incorrecta'
        });
      }

      // Cambiar la contraseña
      const updatedUser = await User.changePassword(userId, newPassword);

      res.status(200).json({
        success: true,
        message: 'Contraseña cambiada exitosamente',
        data: {
          user: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            phone: updatedUser.phone,
            is_active: updatedUser.is_active
          }
        }
      });
    } catch (error) {
      console.error('Error en changePassword:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = UserController;
