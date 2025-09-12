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
  }

  // Método estático para crear un usuario
  static async create(userData) {
    try {
      // 1. Obtener el ID del plan Free
      const { data: freePlan, error: planError } = await supabase
        .from('plans')
        .select('id')
        .eq('name', 'Free')
        .single();

      if (planError || !freePlan) {
        console.error('❌ Error al obtener plan Free:', planError);
        throw new Error('No se pudo obtener el plan Free por defecto');
      }

      // 2. Preparar datos para Supabase (sin plan_id)
      const newUser = {
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        password: userData.password,
        is_active: true
      };

      // 3. Insertar usuario en Supabase
      const { data: insertedUser, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      if (error) {
        console.error('❌ Error al insertar usuario:', error);
        throw new Error(`Error al crear usuario: ${error.message}`);
      }

      // 4. Crear registro en user_plans
      const userPlanData = {
        user_id: insertedUser.id,
        plan_id: freePlan.id,
        start_date: new Date().toISOString(),
        end_date: 'infinity', // Plan Free es infinito
        is_active: true
      };

      const { error: userPlanError } = await supabase
        .from('user_plans')
        .insert([userPlanData]);

      if (userPlanError) {
        console.error('❌ Error al crear user_plan:', userPlanError);
        // No lanzar error aquí, solo log
      }

      // 5. Retornar instancia del modelo User
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
      // 1. Obtener el usuario básico
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Usuario no encontrado
        }
        console.error('Error al obtener usuario por ID:', error);
        throw new Error('No se pudo obtener el usuario');
      }

      // 2. Obtener el plan actual desde user_plans (activo o no)
      const { data: activeUserPlan, error: userPlanError } = await supabase
        .from('user_plans')
        .select(`
          *,
          plans (
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
        .eq('user_id', id)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      if (userPlanError && userPlanError.code !== 'PGRST116') {
        console.error('Error al obtener plan activo:', userPlanError);
        // No lanzar error, continuar sin plan
      }
      
      // 3. Procesar los datos del plan
      if (activeUserPlan && activeUserPlan.plans) {
        user.plan = activeUserPlan.plans;
        user.plan_id = activeUserPlan.plans.id;
        user.plan.is_active = activeUserPlan.is_active; // Incluir el estado del plan
        user.plan.end_date = activeUserPlan.end_date; // Incluir la fecha de fin del plan
        
        // Procesar los módulos del plan
        if (activeUserPlan.plans.plan_modules) {
          user.plan.modules = activeUserPlan.plans.plan_modules.map(pm => pm.modules);
          delete user.plan.plan_modules; // Limpiar datos innecesarios
        }
      } else {
        user.plan = null;
        user.plan_id = null;
      }
      
      const userInstance = new User(user);
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

  // Método estático para actualizar el plan del usuario
  static async updatePlan(userId, planName) {
    try {
      // 1. Obtener el ID del plan por nombre
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id')
        .eq('name', planName)
        .single();

      if (planError || !plan) {
        console.error('Error al obtener plan:', planError);
        throw new Error(`No se pudo encontrar el plan: ${planName}`);
      }

      // 2. Desactivar el plan actual del usuario
      const { error: deactivateError } = await supabase
        .from('user_plans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (deactivateError) {
        console.error('Error al desactivar plan actual:', deactivateError);
        throw new Error('No se pudo desactivar el plan actual');
      }

      // 3. Crear nuevo registro de plan
      const userPlanData = {
        user_id: userId,
        plan_id: plan.id,
        start_date: new Date().toISOString(),
        end_date: planName === 'Free' ? 'infinity' : null, // Plan Free es infinito
        is_active: true
      };

      const { error: insertError } = await supabase
        .from('user_plans')
        .insert([userPlanData]);

      if (insertError) {
        console.error('Error al crear nuevo plan:', insertError);
        throw new Error('No se pudo asignar el nuevo plan');
      }

      return true;
    } catch (error) {
      console.error('Error en updatePlan:', error);
      throw error;
    }
  }
}

module.exports = User;
