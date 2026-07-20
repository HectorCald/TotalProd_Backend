const { supabase } = require('../config/supabase');

class Personal {
  // Constructor para crear un personal
  constructor(data) {
    this.id = data.id;
    this.empresa_id = data.empresa_id;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.email = data.codigo;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.modules = data.modules || [];
  }

  // --- Helpers internos ---
  static async _executeQuery(query, errorMessage) {
    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Personal no encontrado
      }
      if (error.code === '23505') {
        throw new Error('El correo electrónico ya existe en esta empresa');
      }
      console.error(`Error en _executeQuery (${errorMessage}):`, error);
      throw new Error(errorMessage);
    }
    return data;
  }

  static _formatPersonalData(personal) {
    if (!personal) return null;

    // Procesar los módulos
    const modules = personal.personal_modulo_permiso?.map(pmp => ({
      ...pmp.sub_modulos,
      modulos: pmp.sub_modulos.modules // Mapear modules como modulos para el frontend
    })).filter(Boolean) || [];

    // Procesar los permisos
    const permisos = personal.personal_permisos?.[0] ? {
      crear: personal.personal_permisos[0].can_create,
      eliminar: personal.personal_permisos[0].can_delete,
      editar: personal.personal_permisos[0].can_update,
      anular: personal.personal_permisos[0].can_anular,
      reemplazar: personal.personal_permisos[0].can_replace,
      info: personal.personal_permisos[0].can_info,
      sucursales: personal.personal_permisos[0].can_sucursales,
      offline: personal.personal_permisos[0].can_offline
    } : {
      crear: false,
      eliminar: false,
      editar: false,
      anular: false,
      reemplazar: false,
      info: false,
      sucursales: false,
      offline: false
    };

    // Procesar la sucursal con información de la empresa y plan
    const sucursal = personal.sucursales ? {
      id: personal.sucursales.id,
      name: personal.sucursales.name,
      empresas: personal.sucursales.empresas ? {
        id: personal.sucursales.empresas.id,
        name: personal.sucursales.empresas.name,
        logo_tipo: personal.sucursales.empresas.logo_tipo,
        codigo: personal.sucursales.empresas.codigo,
        plan: personal.plan || null // El plan se añadirá después de la consulta
      } : null
    } : null;

    // Procesar los módulos desde el cargo
    let finalModules = [];
    if (personal.cargos && personal.cargos.cargo_sub_modulo) {
        finalModules = personal.cargos.cargo_sub_modulo.map(csm => {
            if (csm.sub_modulos) {
                return {
                    ...csm.sub_modulos,
                    modulos: csm.sub_modulos.modules
                };
            }
            return null;
        }).filter(Boolean);
    } else if (personal.personal_modulo_permiso) {
        // Fallback al anterior por si acaso
        finalModules = personal.personal_modulo_permiso.map(pmp => ({
          ...pmp.sub_modulos,
          modulos: pmp.sub_modulos.modules
        })).filter(Boolean);
    }

    return {
      ...personal,
      email: personal.codigo,
      modules: finalModules,
      permisos: permisos,
      sucursal: sucursal
    };
  }

  static async _savePermissions(personalId, permisos) {
    if (!permisos || Object.keys(permisos).length === 0) return;

    // Primero verificar si la tabla existe
    const { data: tableCheck, error: tableError } = await supabase
      .from('personal_permisos')
      .select('*')
      .limit(1);
      
    if (tableError) return;

    // Eliminar permisos existentes
    await supabase.from('personal_permisos').delete().eq('personal_id', personalId);

    // Insertar nuevos permisos
    await supabase.from('personal_permisos').insert([{
      personal_id: personalId,
      can_delete: permisos.eliminar || false,
      can_create: permisos.crear || false,
      can_update: permisos.editar || false,
      can_anular: permisos.anular || false,
      can_replace: permisos.reemplazar || false,
      can_info: permisos.info || false,
      can_sucursales: permisos.sucursales || false,
      can_offline: permisos.offline || false
    }]);
  }

  // Método para obtener todos los personal de una empresa
  static async getAll(empresaId) {
    try {
      if (!empresaId) throw new Error('ID de la empresa es requerido');

      const query = supabase
        .from('personal')
        .select(`
          *,
          sucursales (id, name, empresas (id, name, logo_tipo, codigo)),
          personal_permisos (can_create, can_delete, can_update, can_anular, can_replace, can_info, can_sucursales, can_offline),
          cargos (id, name, cargo_sub_modulo (sub_modulos (id, name, module_id, modules (id, name, clave))))
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      const data = await this._executeQuery(query, 'No se pudo obtener el personal');
      
      // Obtener el plan de la empresa (solo hacemos una consulta ya que todos son de la misma empresa)
      let plan = null;
      try {
        const User = require('./User');
        plan = await User.getPlanByEmpresaId(empresaId);
      } catch (err) {
        console.error('Error al obtener plan en getAll de Personal:', err);
      }

      return (data || []).map(p => {
          p.plan = plan;
          return this._formatPersonalData(p);
      });
    } catch (error) {
      console.error('Error al obtener el personal:', error);
      throw new Error('No se pudo obtener el personal');
    }
  }

  // Método para obtener personal por ID
  static async getById(id) {
    try {
      if (!id) throw new Error('ID del personal es requerido');

      const query = supabase
        .from('personal')
        .select(`
          *,
          sucursales (id, name, empresas (id, name, logo_tipo, codigo)),
          personal_permisos (can_create, can_delete, can_update, can_anular, can_replace, can_info, can_sucursales, can_offline),
          cargos (id, name, cargo_sub_modulo (sub_modulos (id, name, module_id, modules (id, name, clave))))
        `)
        .eq('id', id)
        .single();

      const data = await this._executeQuery(query, 'No se pudo obtener el personal');
      
      if (data && data.empresa_id) {
        try {
          const User = require('./User');
          data.plan = await User.getPlanByEmpresaId(data.empresa_id);
        } catch (err) {
          console.error('Error al obtener plan en getById de Personal:', err);
        }
      }

      return this._formatPersonalData(data);
    } catch (error) {
      console.error('Error al obtener personal por ID:', error);
      throw new Error('No se pudo obtener el personal');
    }
  }

  // Método para crear personal
  static async create(personalData) {
    try {
      const { first_name, last_name, email, cargo, cargo_id, empresa_id, sucursal_id, permisos = {}, ubicacion = null, rastrear = false } = personalData;

      if (!first_name || !last_name || !email || (!cargo && !cargo_id) || !empresa_id) {
        throw new Error('Datos requeridos faltantes');
      }

      const { data: existingPersonal } = await supabase
        .from('personal')
        .select('id')
        .eq('codigo', email)
        .eq('empresa_id', empresa_id);

      if (existingPersonal && existingPersonal.length > 0) {
        throw new Error('El correo electrónico ya existe en esta empresa');
      }

      const query = supabase
        .from('personal')
        .insert([{
          first_name, last_name, codigo: email, cargo, cargo_id: cargo_id || null,
          empresa_id, sucursal_id: sucursal_id || null, ubicacion, rastrear, is_active: true
        }])
        .select()
        .single();

      const newPersonal = await this._executeQuery(query, 'No se pudo crear el personal');

      if (permisos && Object.keys(permisos).length > 0) {
        await this._savePermissions(newPersonal.id, permisos);
      }

      return await this.getById(newPersonal.id);
    } catch (error) {
      console.error('Error al crear personal:', error);
      throw error;
    }
  }

  // Método para actualizar personal
  static async update(id, personalData) {
    try {
      const { first_name, last_name, email, cargo, cargo_id, is_active, sucursal_id, permisos = {}, ubicacion, rastrear } = personalData;

      if (!id) throw new Error('ID del personal es requerido');

      const currentPersonal = await this.getById(id);
      if (!currentPersonal) throw new Error('Personal no encontrado');

      if (email && email !== currentPersonal.email) {
        const { data: existingPersonal } = await supabase
          .from('personal')
          .select('id')
          .eq('codigo', email)
          .eq('empresa_id', currentPersonal.empresa_id)
          .neq('id', id);

        if (existingPersonal && existingPersonal.length > 0) {
          throw new Error('El correo electrónico ya existe en esta empresa');
        }
      }

      const updateData = {};
      if (first_name) updateData.first_name = first_name;
      if (last_name) updateData.last_name = last_name;
      if (email) updateData.codigo = email;
      if (cargo !== undefined) updateData.cargo = cargo;
      if (cargo_id !== undefined) updateData.cargo_id = cargo_id;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (sucursal_id !== undefined) updateData.sucursal_id = sucursal_id;
      if (ubicacion !== undefined) updateData.ubicacion = ubicacion;
      if (rastrear !== undefined) updateData.rastrear = rastrear;

      const query = supabase
        .from('personal')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      await this._executeQuery(query, 'No se pudo actualizar el personal');

      if (permisos && Object.keys(permisos).length > 0) {
        await this._savePermissions(id, permisos);
      }

      return await this.getById(id);
    } catch (error) {
      console.error('Error al actualizar personal:', error);
      throw error;
    }
  }

  // Método para eliminar personal
  static async delete(id) {
    try {
      if (!id) throw new Error('ID del personal es requerido');

      await supabase.from('personal_permisos').delete().eq('personal_id', id);
      await supabase.from('personal_modulo_permiso').delete().eq('personal_id', id);

      const query = supabase.from('personal').delete().eq('id', id);
      await this._executeQuery(query, 'No se pudo eliminar el personal');

      return true;
    } catch (error) {
      console.error('Error al eliminar personal:', error);
      throw error;
    }
  }

  // Método para obtener personal por correo
  static async getByEmail(email) {
    try {
      if (!email) throw new Error('Correo electrónico es requerido');

      const query = supabase
        .from('personal')
        .select(`
          *,
          sucursales (id, name, empresas (id, name, logo_tipo, codigo)),
          personal_permisos (can_create, can_delete, can_update, can_anular, can_replace, can_info, can_sucursales, can_offline),
          cargos (id, name, cargo_sub_modulo (sub_modulos (id, name, module_id, modules (id, name, clave))))
        `)
        .eq('codigo', email)
        .single();

      const personalData = await this._executeQuery(query, 'No se pudo obtener el personal');
      if (!personalData) return null;

      if (personalData.empresa_id) {
        try {
          const User = require('./User');
          personalData.plan = await User.getPlanByEmpresaId(personalData.empresa_id);
        } catch (err) {
          console.error('Error al obtener plan en getByEmail de Personal:', err);
        }
      }

      return this._formatPersonalData(personalData);
    } catch (error) {
      console.error('Error al obtener personal por correo:', error);
      throw new Error('No se pudo obtener el personal');
    }
  }

  // Método para establecer contraseña
  static async setPassword(id, password) {
    try {
      if (!id || !password) throw new Error('ID del personal y contraseña son requeridos');

      const bcrypt = require('bcryptjs');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const query = supabase
        .from('personal')
        .update({ password: hashedPassword, is_active: true })
        .eq('id', id)
        .select()
        .single();

      return await this._executeQuery(query, 'No se pudo establecer la contraseña');
    } catch (error) {
      console.error('Error al establecer contraseña:', error);
      throw error;
    }
  }

  // Método para login de empleado
  static async loginEmployee(email, password) {
    try {
      if (!email || !password) throw new Error('Correo electrónico y contraseña son requeridos');

      const personal = await this.getByEmail(email);
      if (!personal) return { success: false, message: 'Correo de empleado no válido' };
      if (!personal.is_active) return { success: false, message: 'Su cuenta está inactiva. Contacte al administrador.' };
      if (!personal.password) return { success: false, message: 'No tiene contraseña establecida' };

      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare(password, personal.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'La contraseña ingresada no es correcta. Verifica que estés usando la contraseña de tu cuenta e intenta nuevamente.'
        };
      }

      const { generateToken } = require('../config/jwt');
      const tokenPayload = { id: personal.id, empresa_id: personal.empresa_id, type: 'employee' };
      const token = generateToken(tokenPayload);

      return {
        success: true,
        data: {
          personal: personal,
          token: token
        }
      };
    } catch (error) {
      console.error('Error en login de empleado:', error);
      return { success: false, message: 'Error en el login' };
    }
  }

  // Método para cambiar contraseña de empleado
  static async changePassword(id, currentPassword, newPassword) {
    try {
      if (!id || !currentPassword || !newPassword) throw new Error('ID del personal, contraseña actual y nueva contraseña son requeridos');

      const personal = await this.getById(id);
      if (!personal) return { success: false, message: 'Personal no encontrado' };
      if (!personal.password) return { success: false, message: 'No tiene contraseña establecida' };

      const bcrypt = require('bcryptjs');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, personal.password);
      if (!isCurrentPasswordValid) return { success: false, message: 'La contraseña actual es incorrecta' };

      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      const query = supabase
        .from('personal')
        .update({ password: hashedNewPassword })
        .eq('id', id)
        .select()
        .single();

      await this._executeQuery(query, 'No se pudo cambiar la contraseña');

      return { success: true, message: 'Contraseña cambiada exitosamente' };
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      return { success: false, message: error.message };
    }
  }

  // Método para resetear contraseña
  static async resetPassword(id) {
    try {
      if (!id) throw new Error('ID del personal es requerido');

      const personal = await this.getById(id);
      if (!personal) return { success: false, message: 'Personal no encontrado' };

      const query = supabase
        .from('personal')
        .update({ password: null })
        .eq('id', id)
        .select()
        .single();

      await this._executeQuery(query, 'No se pudo resetear la contraseña');

      return {
        success: true,
        message: 'Contraseña reseteada exitosamente. El empleado deberá establecer una nueva contraseña.'
      };
    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = Personal;