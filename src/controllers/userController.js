const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');

class UserController {
  static async createUser(req, res) {
    try {
      const { name, telefono, emailRegister, passwordRegister } = req.body;

      // Validar campos requeridos
      if (!name || !telefono || !emailRegister || !passwordRegister) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, email y contraseña son requeridos'
        });
      }

      // Encriptar la contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(passwordRegister, saltRounds);

      // Crear el usuario
      const newUser = await User.create({
        nombre: name,
        telefono: telefono,
        email: emailRegister,
        contrasena: hashedPassword,
        estado: 'Activo',
        fechaCreacion: new Date().toISOString()
      });

      // Generar token JWT
      const tokenPayload = {
        id: newUser.id,
        telefono: newUser.telefono,
        email: newUser.email,
        nombre: newUser.nombre,
        estado: newUser.estado
      };

      const token = generateToken(tokenPayload);

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: {
          user: {
            id: newUser.id,
            nombre: newUser.nombre,
            telefono: newUser.telefono,
            email: newUser.email,
            estado: newUser.estado
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
  static async getUserByPhone(req, res) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
            message: 'Celular es requerido'
        });
      }

      const user = await User.getByPhone(phone);

      if (user) {
        return res.status(200).json({
          success: true,
          message: 'Celular ya existe',
          data: { exists: true }
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'Celular disponible',
          data: { exists: false }
        });
      }
    } catch (error) {
      console.error('Error en getUserByPhone:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para login de usuario
  static async login(req, res) {
    try {
      
      const { phone, password } = req.body;

      // Validar campos requeridos
      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          message: 'Celular y contraseña son requeridos'
        });
      }

      // Validar credenciales usando el modelo
      const user = await User.login(phone, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // Generar token JWT
      const tokenPayload = {
        id: user.id,
        phone: user.phone,
        nombre: user.nombre,
        estado: user.estado
      };

      const token = generateToken(tokenPayload);

      res.status(200).json({
        success: true,
        message: 'Login exitoso',
        data: {
          user: {
            id: user.id,
            nombre: user.nombre,
            phone: user.phone,
            estado: user.estado
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
}

module.exports = UserController;
