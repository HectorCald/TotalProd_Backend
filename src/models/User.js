const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.name
    this.phone = data.phone;
    this.password = data.password
    this.is_active = data.is_active;
    this.role = data.role_id
    this.company_type_id = data.company_type_id
  }

  // Método estático para crear un usuario
  static async create(userData) {
    try {
      // Preparar datos para Supabase (mapear a la estructura de la tabla)
      const newUser = {
        name: userData.nombre,                    // nombre → name
        phone: userData.phone,      // celular
        password: userData.password,            // contrasena → password
        is_active: true, // estado → is_active (boolean)
        role_id: '00000000-0000-0000-0000-000000000001',                             // rol por defecto
        company_type_id: userData.compañia,
        created_at: new Date().toISOString()
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
  static async login(phone, password) {
    try {
      // Buscar usuario por email
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
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
  static async getByPhone(phone) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Usuario no encontrado
        }
        console.error('Error al obtener usuario por celular:', error);
        throw new Error('No se pudo obtener el usuario');
      }

      return new User(user);
    } catch (error) {
      console.error('Error al obtener usuario por celular:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  }
}

module.exports = User;
