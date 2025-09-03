const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.email = data.email;
    this.phone = data.phone;
    this.password = data.password;
    this.is_active = data.is_active;
    this.plan_id = data.plan_id;
    this.plan = data.plans || null;
    this.modules = data.plans?.modules || [];
  }

  // Método estático para crear un usuario
  static async create(userData) {
    try {
      // Preparar datos para Supabase (mapear a la estructura de la tabla)
      const newUser = {
        first_name: userData.firstName,                    // nombre → name
        last_name: userData.lastName,
        email: userData.email,
        phone: userData.phone,      // celular
        password: userData.password,            // contrasena → password
        is_active: true, // estado → is_active (boolean)
      };

      // Insertar en Supabase
      const { data: insertedUser, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al insertar usuario:', error);
        throw new Error(`Error al crear usuario: ${error.message}`);
      }

      // Retornar instancia del modelo User
      return new User(insertedUser);

    } catch (error) {
      console.error('💥 Error en create:', error);
      throw new Error(`Error al crear usuario: ${error.message}`);
    }
  }

  // Método estático para validar credenciales de login
  static async login(email, password) {
    try {
      // Buscar usuario por email
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('❌ Usuario no encontrado');
          return null;
        }
        console.error('❌ Error de Supabase:', error);
        throw new Error('Error al buscar usuario');
      }

      if (!user) {
        console.log('❌ Usuario no encontrado');
        return null;
      }

      // Verificar contraseña
      if (!user.password) {
        console.log('❌ Usuario sin contraseña');
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        console.log('❌ Contraseña incorrecta');
        return null;
      }

      return new User(user);

    } catch (error) {
      console.error('💥 Error en validateCredentials:', error);
      throw new Error('Error en la validación de credenciales');
    }
  }

  // Método estático para obtener usuario por celular
  static async getByEmail(email) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Usuario no encontrado
        }
        console.error('Error al obtener usuario por email:', error);
        throw new Error('No se pudo obtener el usuario');
      }

      return new User(user);
    } catch (error) {
      console.error('Error al obtener usuario por email:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  }

  // Método estático para obtener usuario por ID
  static async getById(id) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          *,
          plans:plan_id (
            id,
            name,
            price,
            duration,
            plan_modules (
              modules (
                id,
                name,
                description
              )
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Usuario no encontrado
        }
        console.error('Error al obtener usuario por ID:', error);
        throw new Error('No se pudo obtener el usuario');
      }

      console.log('🔍 User Model - getById - Raw data from Supabase:', user);
      
      // Procesar los módulos del plan
      if (user.plans && user.plans.plan_modules) {
        user.plans.modules = user.plans.plan_modules.map(pm => pm.modules);
        delete user.plans.plan_modules; // Limpiar datos innecesarios
      }
      
      const userInstance = new User(user);
      console.log('🔍 User Model - getById - User instance:', userInstance);
      return userInstance;
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  }

  // Método estático para verificar contraseña actual
  static async verifyPassword(userId, currentPassword) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error al obtener usuario para verificar contraseña:', error);
        throw new Error('No se pudo verificar la contraseña');
      }

      if (!user || !user.password) {
        return false;
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      return isPasswordValid;
    } catch (error) {
      console.error('Error en verifyPassword:', error);
      throw new Error('No se pudo verificar la contraseña');
    }
  }

  // Método estático para cambiar contraseña
  static async changePassword(userId, newPassword) {
    try {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error al cambiar contraseña:', error);
        throw new Error('No se pudo cambiar la contraseña');
      }

      return new User(updatedUser);
    } catch (error) {
      console.error('Error en changePassword:', error);
      throw new Error('No se pudo cambiar la contraseña');
    }
  }
}

module.exports = User;
