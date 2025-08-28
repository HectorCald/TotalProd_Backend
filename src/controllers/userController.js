const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/jwt');

class UserController {
  // GET /api/users - Obtener todos los usuarios
  static async getAllUsers(req, res) {
    try {
      const users = await User.getAll();
      res.status(200).json({
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: users,
        count: users.length
      });
    } catch (error) {
      console.error('Error en getAllUsers:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // GET /api/users/:id - Obtener usuario por ID
  static async getUserById(req, res) {
    try {
      const { id } = req.params;
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
        data: user
      });
    } catch (error) {
      console.error('Error en getUserById:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // POST /api/users/login - Validar credenciales de login
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Validar que se proporcionen email y password
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Correo electrónico y contraseña son requeridos'
        });
      }

      const user = await User.validateCredentials(email, password);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Correo electrónico o contraseña incorrecto'
        });
      }

      // Generar token JWT para el login
      const tokenPayload = {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        telefono: user.telefono,
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
            telefono: user.telefono,
            email: user.email,
            estado: user.estado
          },
          token: token
        }
      });
    } catch (error) {
      console.error('❌ Error en login:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // GET /api/users/profile/:email - Obtener perfil de usuario por email
  static async getUserProfile(req, res) {
    try {
      const { email } = req.params;
      const user = await User.getByEmail(email);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Perfil obtenido exitosamente',
        data: user
      });
    } catch (error) {
      console.error('Error en getUserProfile:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // POST /api/users/create - Crear nuevo usuario
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
}

module.exports = UserController;
