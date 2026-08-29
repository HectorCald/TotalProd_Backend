const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class User {

  // Constructor para crear un usuario
  constructor(data) {
    this.id = data.id;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.email = data.email;
    this.phone = data.phone;
    this.password = data.password;
    this.is_active = data.is_active;
    this.plan_id = data.plan_id || null; // Ahora viene de user_plans
    this.plan = data.plan || null; // Ahora viene de user_plans
    this.modules = data.plan?.modules || [];
    this.empresa_id = data.empresa_id || null;
    this.empresa = data.empresa || null;
    this.logo_tipo = data.logo_tipo || null; // Logo de la empresa
  }

  /**
   * Genera un código único para empresa: nombre (minúscula, sin espacios/acentos) + inicial primer nombre + inicial primer apellido.
   * Si ya existe, añade 1, 2, etc. al final.
   */
  static async generateCodigoEmpresa(nameStore, firstName, lastName) {
    const normalize = (text) => {
      if (!text || typeof text !== 'string') return '';
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '');
    };
    const nombreEmpresa = normalize(nameStore);
    const inicialNombre = firstName && firstName.trim().length > 0 ? normalize(firstName.trim()[0]) : '';
    const inicialApellido = lastName && lastName.trim().length > 0 ? normalize(lastName.trim()[0]) : '';
    const baseCodigo = nombreEmpresa + inicialNombre + inicialApellido;
    if (!baseCodigo) return null;

    let candidate = baseCodigo;
    let suffix = 0;
    for (;;) {
      const { data: existing, error } = await supabase
        .from('empresas')
        .select('id')
        .eq('codigo', candidate)
        .maybeSingle();
      if (error) throw new Error(`Error al verificar código de empresa: ${error.message}`);
      if (!existing) return candidate;
      suffix += 1;
      candidate = baseCodigo + String(suffix);
    }
  }

  // Método estático para crear un usuario
  static async create(userData) {
    try {
      // 1. Preparar datos para Supabase (sin plan_id)
      const newUser = {
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.email,
        phone: null, // Siempre null según nueva estructura
        password: userData.password,
        is_active: true
      };

      // 2. Insertar usuario en Supabase
      const { data: insertedUser, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al insertar usuario:', error);
        throw new Error(`Error al crear usuario: ${error.message}`);
      }

      // 5. Generar código único: nombre empresa (minúscula, sin espacios/acentos) + inicial nombre + inicial apellido; si existe, añadir 1, 2, etc.
      const codigo = await User.generateCodigoEmpresa(
        userData.nameStore,
        userData.firstName,
        userData.lastName
      );

      // 6. Crear empresa para el usuario (OBLIGATORIO)
      const empresaData = {
        name: userData.nameStore, // Ya validado en frontend, no necesita fallback
        description: null, // Siempre null según nueva estructura
        propietario_id: insertedUser.id,
        tipo: null, // Tipo inicial null, se seleccionará después
        codigo: codigo
      };

      const { data: insertedEmpresa, error: empresaError } = await supabase
        .from('empresas')
        .insert([empresaData])
        .select()
        .single();

      if (empresaError) {
        console.error('❌ Error al crear empresa:', empresaError);
        throw new Error(`Error al crear empresa: ${empresaError.message}`);
      }

      if (!insertedEmpresa) {
        throw new Error('No se pudo crear la empresa');
      }

      // 7. Crear sucursal "Casa Matriz" para la empresa (OBLIGATORIO)
      const sucursalData = {
        empresa_id: insertedEmpresa.id,
        name: 'Casa Matriz'
      };

      const { error: sucursalError } = await supabase
        .from('branches')
        .insert([sucursalData]);

      if (sucursalError) {
        console.error('❌ Error al crear sucursal:', sucursalError);
        throw new Error(`Error al crear sucursal Casa Matriz: ${sucursalError.message}`);
      }

      // 8. Crear tipo de precio por defecto "Principal" para la empresa (OBLIGATORIO)
      const precioTypeData = {
        empresa_id: insertedEmpresa.id,
        name: 'Principal',
        description: 'Precio principal del producto'
      };

      const { error: precioTypeError } = await supabase
        .from('prices_types')
        .insert([precioTypeData]);

      if (precioTypeError) {
        console.error('❌ Error al crear tipo de precio por defecto:', precioTypeError);
        throw new Error(`Error al crear tipo de precio Principal: ${precioTypeError.message}`);
      }

      // 9. Retornar instancia del modelo User
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

      // Verificar si está activo
      if (!user.is_active) {
        console.log('❌ Usuario inactivo');
        throw new Error('INACTIVE_ACCOUNT');
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
      console.error('💥 Error en login:', error);
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
      // 1. Obtener el usuario básico con su empresa y sucursales
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          *,
          empresas!empresas_propietario_id_fkey (
            id,
            name,
            description,
            logo_tipo,
            tipo,
            codigo,
            branches (*)
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

      user.plan = null;
      user.plan_id = null;

      // Procesar datos de la empresa
      if (user.empresas && user.empresas.length > 0) {
        user.empresa = user.empresas[0]; // El usuario es propietario de una empresa
        user.empresa_id = user.empresas[0].id;
        user.logo_tipo = user.empresas[0].logo_tipo; // Incluir el logo de la empresa
        user.empresa.tipo = user.empresas[0].tipo; // Incluir el tipo de la empresa
        user.empresa.plan = null;

        delete user.empresas; // Limpiar datos innecesarios
      } else {
        user.empresa = null;
        user.empresa_id = null;
        user.logo_tipo = null;
      }
      
      const userInstance = new User(user);
      return userInstance;
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  }

  static async getPlanByEmpresaId(empresaId) {
    return null;
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

  // Método estático para actualizar el plan del usuario
  static async updatePlan(userId, planName) {
    return true;
  }

  // Método estático para actualizar datos de usuario y empresa
  static async updateConfig(userId, empresaId, userData, empresaData) {
    try {
      // 1. Actualizar usuario
      const { data: updatedUser, error: userError } = await supabase
        .from('users')
        .update({
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          email: userData.email
        })
        .eq('id', userId)
        .select()
        .single();

      if (userError) {
        console.error('Error al actualizar usuario:', userError);
        throw new Error('No se pudo actualizar los datos del usuario');
      }

      // 2. Actualizar empresa si hay empresaId
      let updatedEmpresa = null;
      if (empresaId && empresaData) {
        const updateData = {
          name: empresaData.name,
          description: empresaData.description,
          codigo: empresaData.codigo
        };

        if (empresaData.logo_tipo !== undefined) {
          updateData.logo_tipo = empresaData.logo_tipo;
        }

        const { data: empresaRes, error: empresaError } = await supabase
          .from('empresas')
          .update(updateData)
          .eq('id', empresaId)
          .select()
          .single();

        if (empresaError) {
          console.error('Error al actualizar empresa:', empresaError);
          throw new Error('No se pudo actualizar los datos de la empresa');
        }
        updatedEmpresa = empresaRes;
      }

      return {
        user: updatedUser,
        empresa: updatedEmpresa
      };
    } catch (error) {
      console.error('Error en updateConfig:', error);
      throw error;
    }
  }
}

module.exports = User;
