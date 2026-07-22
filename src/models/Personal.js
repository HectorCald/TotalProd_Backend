const { supabase } = require('../config/supabase');

class Personal {
  // Constructor para crear un personal
  constructor(data) {
    this.id = data.id;
    this.company_id = data.company_id || data.empresa_id;
    this.empresa_id = this.company_id;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.phone = data.phone || data.celular;
    this.email = data.email || data.codigo;
    this.position_id = data.position_id || data.cargo_id;
    this.cargo_id = this.position_id;
    this.branch_id = data.branch_id || data.sucursal_id;
    this.sucursal_id = this.branch_id;
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

    // Procesar los permisos
    const permissionsData = personal.staff_permissions?.[0] || personal.personal_permisos?.[0];
    const permisos = permissionsData ? {
      crear: permissionsData.can_create,
      eliminar: permissionsData.can_delete,
      editar: permissionsData.can_update,
      anular: permissionsData.can_anular,
      reemplazar: permissionsData.can_replace,
      info: permissionsData.can_info,
      sucursales: permissionsData.can_sucursales,
      offline: permissionsData.can_offline
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
    const branchData = personal.branches || personal.sucursales;
    const sucursal = branchData ? {
      id: branchData.id,
      name: branchData.name,
      empresas: branchData.empresas ? {
        id: branchData.empresas.id,
        name: branchData.empresas.name,
        logo_tipo: branchData.empresas.logo_tipo,
        codigo: branchData.empresas.codigo,
        plan: personal.plan || null
      } : null
    } : null;

    // Procesar los módulos desde el cargo/posicion
    const cargoData = personal.cargos || personal.cargos_position_id;
    let finalModules = [];
    if (cargoData && cargoData.cargo_sub_modulo) {
        finalModules = cargoData.cargo_sub_modulo.map(csm => {
            if (csm.sub_modulos) {
                return {
                    ...csm.sub_modulos,
                    modulos: csm.sub_modulos.modules
                };
            }
            return null;
        }).filter(Boolean);
    }

    const cargoName = cargoData?.name || personal.cargo || '--';
    const userEmail = personal.email || personal.codigo || '--';

    return {
      ...personal,
      company_id: personal.company_id || personal.empresa_id,
      empresa_id: personal.company_id || personal.empresa_id,
      position_id: personal.position_id || personal.cargo_id,
      cargo_id: personal.position_id || personal.cargo_id,
      branch_id: personal.branch_id || personal.sucursal_id,
      sucursal_id: personal.branch_id || personal.sucursal_id,
      email: userEmail,
      codigo: userEmail,
      cargo: cargoName,
      cargos: cargoData || null,
      modules: finalModules,
      permisos: permisos,
      sucursal: sucursal
    };
  }

  static async _savePermissions(personalId, permisos) {
    if (!permisos || Object.keys(permisos).length === 0) return;

    // Primero verificar si la tabla existe
    const { data: tableCheck, error: tableError } = await supabase
      .from('staff_permissions')
      .select('*')
      .limit(1);
      
    if (tableError) return;

    // Eliminar permisos existentes
    await supabase.from('staff_permissions').delete().eq('member_id', personalId);

    // Insertar nuevos permisos
    await supabase.from('staff_permissions').insert([{
      member_id: personalId,
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
        .from('staff')
        .select(`
          *,
          branches (id, name, empresas (id, name, logo_tipo, codigo)),
          staff_permissions (can_create, can_delete, can_update, can_anular, can_replace, can_info, can_sucursales, can_offline),
          cargos:position_id (id, name, cargo_sub_modulo (sub_modulos (id, name, module_id, modules (id, name, clave))))
        `)
        .eq('company_id', empresaId)
        .order('created_at', { ascending: false });

      const data = await this._executeQuery(query, 'No se pudo obtener el personal');
      
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
        .from('staff')
        .select(`
          *,
          branches (id, name, empresas (id, name, logo_tipo, codigo)),
          staff_permissions (can_create, can_delete, can_update, can_anular, can_replace, can_info, can_sucursales, can_offline),
          cargos:position_id (id, name, cargo_sub_modulo (sub_modulos (id, name, module_id, modules (id, name, clave))))
        `)
        .eq('id', id)
        .single();

      const data = await this._executeQuery(query, 'No se pudo obtener el personal');
      
      const companyId = data?.company_id || data?.empresa_id;
      if (data && companyId) {
        try {
          const User = require('./User');
          data.plan = await User.getPlanByEmpresaId(companyId);
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
      const { first_name, last_name, email, position_id, cargo_id, empresa_id, company_id, branch_id, sucursal_id, phone, permisos = {} } = personalData;
      const targetCompanyId = company_id || empresa_id;
      const targetPositionId = position_id || cargo_id;
      const targetBranchId = branch_id || sucursal_id;

      if (!first_name || !last_name || !email || !targetCompanyId) {
        throw new Error('Datos requeridos faltantes');
      }

      const { data: existingPersonal } = await supabase
        .from('staff')
        .select('id')
        .eq('email', email)
        .eq('company_id', targetCompanyId);

      if (existingPersonal && existingPersonal.length > 0) {
        throw new Error('El correo electrónico ya existe en esta empresa');
      }

      const query = supabase
        .from('staff')
        .insert([{
          first_name,
          last_name,
          phone: phone || null,
          email,
          position_id: targetPositionId || null,
          company_id: targetCompanyId,
          branch_id: targetBranchId || null,
          is_active: true
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
      const { first_name, last_name, email, phone, position_id, cargo_id, is_active, branch_id, sucursal_id, permisos } = personalData;
      const targetPositionId = position_id !== undefined ? position_id : cargo_id;
      const targetBranchId = branch_id !== undefined ? branch_id : sucursal_id;

      if (!id) throw new Error('ID del personal es requerido');

      const currentPersonal = await this.getById(id);
      if (!currentPersonal) throw new Error('Personal no encontrado');

      const currentCompanyId = currentPersonal.company_id || currentPersonal.empresa_id;

      if (email && email !== currentPersonal.email) {
        const { data: existingPersonal } = await supabase
          .from('staff')
          .select('id')
          .eq('email', email)
          .eq('company_id', currentCompanyId)
          .neq('id', id);

        if (existingPersonal && existingPersonal.length > 0) {
          throw new Error('El correo electrónico ya existe en esta empresa');
        }
      }

      const updateData = {};
      if (first_name) updateData.first_name = first_name;
      if (last_name) updateData.last_name = last_name;
      if (phone !== undefined) updateData.phone = phone;
      if (email) updateData.email = email;
      if (targetPositionId !== undefined) updateData.position_id = targetPositionId;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (targetBranchId !== undefined) updateData.branch_id = targetBranchId;

      const query = supabase
        .from('staff')
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

      await supabase.from('staff_permissions').delete().eq('member_id', id);

      const query = supabase.from('staff').delete().eq('id', id);
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
        .from('staff')
        .select(`
          *,
          branches (id, name, empresas (id, name, logo_tipo, codigo)),
          staff_permissions (can_create, can_delete, can_update, can_anular, can_replace, can_info, can_sucursales, can_offline),
          cargos:position_id (id, name, cargo_sub_modulo (sub_modulos (id, name, module_id, modules (id, name, clave))))
        `)
        .eq('email', email)
        .single();

      const personalData = await this._executeQuery(query, 'No se pudo obtener el personal');
      if (!personalData) return null;

      const companyId = personalData.company_id || personalData.empresa_id;
      if (companyId) {
        try {
          const User = require('./User');
          personalData.plan = await User.getPlanByEmpresaId(companyId);
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
        .from('staff')
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
      const companyId = personal.company_id || personal.empresa_id;
      const tokenPayload = { id: personal.id, empresa_id: companyId, company_id: companyId, type: 'employee' };
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
        .from('staff')
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
        .from('staff')
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