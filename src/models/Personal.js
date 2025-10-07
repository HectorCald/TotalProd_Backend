const { supabase } = require('../config/supabase');

class Personal {
  // Constructor para crear un personal
  constructor(data) {
    this.id = data.id;
    this.empresa_id = data.empresa_id;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.codigo = data.codigo;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.modules = data.modules || [];
  }

  // Método para obtener todos los personal de una empresa
  static async getAll(empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const { data, error } = await supabase
        .from('personal')
        .select(`
          *,
          sucursales (
            id,
            name
          ),
          personal_modulo_permiso (
            sub_modulo_id,
            sub_modulos (
              id,
              name,
              module_id,
              modules (
                id,
                name
              )
            )
          ),
          personal_permisos (
            can_create,
            can_delete,
            can_update,
            can_anular
          )
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('No se pudo obtener el personal');
      }

      // Procesar los datos para incluir módulos y permisos
      const processedData = (data || []).map(personal => {
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
          anular: personal.personal_permisos[0].can_anular
        } : {
          crear: false,
          eliminar: false,
          editar: false,
          anular: false
        };

        // Procesar la sucursal
        const sucursal = personal.sucursales ? {
          id: personal.sucursales.id,
          name: personal.sucursales.name
        } : null;

        return {
          ...personal,
          modules: modules,
          permisos: permisos,
          sucursal: sucursal
        };
      });
      
      return processedData;
    } catch (error) {
      console.error('Error al obtener el personal:', error);
      throw new Error('No se pudo obtener el personal');
    }
  }


  // Método para obtener personal por ID
  static async getById(id) {
    try {
      if (!id) {
        throw new Error('ID del personal es requerido');
      }

      const { data, error } = await supabase
        .from('personal')
        .select(`
          *,
          sucursales (
            id,
            name
          ),
          personal_modulo_permiso (
            sub_modulo_id,
            sub_modulos (
              id,
              name,
              module_id,
              modules (
                id,
                name
              )
            )
          ),
          personal_permisos (
            can_create,
            can_delete,
            can_update,
            can_anular
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Personal no encontrado
        }
        throw new Error('No se pudo obtener el personal');
      }

      // Procesar los módulos
      const modules = data.personal_modulo_permiso?.map(pmp => ({
        ...pmp.sub_modulos,
        modulos: pmp.sub_modulos.modules // Mapear modules como modulos para el frontend
      })).filter(Boolean) || [];

      // Procesar los permisos
      const permisos = data.personal_permisos?.[0] ? {
        crear: data.personal_permisos[0].can_create,
        eliminar: data.personal_permisos[0].can_delete,
        editar: data.personal_permisos[0].can_update,
        anular: data.personal_permisos[0].can_anular
      } : {
        crear: false,
        eliminar: false,
        editar: false,
        anular: false
      };

      // Procesar la sucursal
      const sucursal = data.sucursales ? {
        id: data.sucursales.id,
        name: data.sucursales.name
      } : null;
      
      return {
        ...data,
        modules: modules,
        permisos: permisos,
        sucursal: sucursal
      };
    } catch (error) {
      console.error('Error al obtener personal por ID:', error);
      throw new Error('No se pudo obtener el personal');
    }
  }

  // Método para verificar si un código existe
  static async codigoExists(codigo, empresaId, excludeId = null) {
    try {
      if (!codigo || !empresaId) {
        return false;
      }

      let query = supabase
        .from('personal')
        .select('id')
        .eq('codigo', codigo)
        .eq('empresa_id', empresaId);

      // Excluir un ID específico (para actualizaciones)
      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error al verificar código:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error al verificar código:', error);
      return false;
    }
  }

  // Método para crear personal
  static async create(personalData) {
    try {
      const { first_name, last_name, codigo, empresa_id, sucursal_id, modules = [], permisos = {} } = personalData;

      if (!first_name || !last_name || !codigo || !empresa_id) {
        throw new Error('Datos requeridos faltantes');
      }

      // Verificar que el código no exista
      const codigoExiste = await this.codigoExists(codigo, empresa_id);
      if (codigoExiste) {
        throw new Error('El código ya existe en esta empresa');
      }

      // Crear el personal
      const { data: newPersonal, error } = await supabase
        .from('personal')
        .insert([{
          first_name,
          last_name,
          codigo,
          empresa_id,
          sucursal_id: sucursal_id || null,
          is_active: false
        }])
        .select()
        .single();

      if (error) {
        throw new Error('No se pudo crear el personal');
      }

      // Crear permisos si existen
      if (permisos && Object.keys(permisos).length > 0) {
        // Primero verificar si la tabla existe y ver su estructura
        const { data: tableCheck, error: tableError } = await supabase
          .from('personal_permisos')
          .select('*')
          .limit(1);
          
        if (tableError) {
          return new Personal(newPersonal);
        }
        
        const { error: permisosError } = await supabase
          .from('personal_permisos')
          .insert([{
            personal_id: newPersonal.id,
            can_delete: permisos.eliminar || false,
            can_create: permisos.crear || false,
            can_update: permisos.editar || false,
            can_anular: permisos.anular || false
          }]);

        if (permisosError) {
          // No lanzar error aquí, solo log
        }
      }

      // Crear relaciones con submódulos si existen
      if (modules && modules.length > 0) {
        const personalModuloData = modules.map(moduleId => ({
          personal_id: newPersonal.id,
          sub_modulo_id: moduleId
        }));

        const { error: moduleError } = await supabase
          .from('personal_modulo_permiso')
          .insert(personalModuloData);

        if (moduleError) {
          // No lanzar error aquí, solo log
        }
      }

      return new Personal(newPersonal);
    } catch (error) {
      console.error('Error al crear personal:', error);
      throw error;
    }
  }

  // Método para actualizar personal
  static async update(id, personalData) {
    try {
      const { first_name, last_name, codigo, is_active, sucursal_id, modules = [], permisos = {} } = personalData;

      if (!id) {
        throw new Error('ID del personal es requerido');
      }

      // Obtener el personal actual para verificar empresa_id
      const currentPersonal = await this.getById(id);
      if (!currentPersonal) {
        throw new Error('Personal no encontrado');
      }

      // Verificar que el código no exista (excluyendo el actual)
      if (codigo && codigo !== currentPersonal.codigo) {
        const codigoExiste = await this.codigoExists(codigo, currentPersonal.empresa_id, id);
        if (codigoExiste) {
          throw new Error('El código ya existe en esta empresa');
        }
      }

      // Actualizar el personal
      const updateData = {};
      if (first_name) updateData.first_name = first_name;
      if (last_name) updateData.last_name = last_name;
      if (codigo) updateData.codigo = codigo;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (sucursal_id !== undefined) updateData.sucursal_id = sucursal_id;

      const { data: updatedPersonal, error } = await supabase
        .from('personal')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error('No se pudo actualizar el personal');
      }

      // Actualizar permisos si existen
      if (permisos && Object.keys(permisos).length > 0) {
        // Eliminar permisos existentes
        const { error: deletePermisosError } = await supabase
          .from('personal_permisos')
          .delete()
          .eq('personal_id', id);

        if (deletePermisosError) {
          // No lanzar error aquí, solo log
        }

        // Crear nuevos permisos
        const { error: permisosError } = await supabase
          .from('personal_permisos')
          .insert([{
            personal_id: id,
            can_delete: permisos.eliminar || false,
            can_create: permisos.crear || false,
            can_update: permisos.editar || false,
            can_anular: permisos.anular || false
          }]);

        if (permisosError) {
          // No lanzar error aquí, solo log
        }
      }

      // Actualizar relaciones con submódulos
      if (modules !== undefined) {
        // Eliminar relaciones existentes
        const { error: deleteError } = await supabase
          .from('personal_modulo_permiso')
          .delete()
          .eq('personal_id', id);

        if (deleteError) {
          // No lanzar error aquí, solo log
        }

        // Crear nuevas relaciones si existen módulos
        if (modules.length > 0) {
          const personalModuloData = modules.map(moduleId => ({
            personal_id: id,
            sub_modulo_id: moduleId
          }));

          const { error: moduleError } = await supabase
            .from('personal_modulo_permiso')
            .insert(personalModuloData);

          if (moduleError) {
            // No lanzar error aquí, solo log
          }
        }
      }

      // Obtener los datos completos del personal actualizado
      const completePersonal = await this.getById(id);
      return completePersonal;
    } catch (error) {
      console.error('Error al actualizar personal:', error);
      throw error;
    }
  }

  // Método para eliminar personal
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del personal es requerido');
      }

      // Eliminar permisos del personal primero (posible FK)
      const { error: permisosError } = await supabase
        .from('personal_permisos')
        .delete()
        .eq('personal_id', id);

      if (permisosError) {
        console.error('Error al eliminar permisos del personal:', permisosError);
      }

      // Eliminar relaciones de módulos primero
      const { error: moduleError } = await supabase
        .from('personal_modulo_permiso')
        .delete()
        .eq('personal_id', id);

      if (moduleError) {
        console.error('Error al eliminar relaciones de módulos:', moduleError);
      }

      // Eliminar el personal
      const { error } = await supabase
        .from('personal')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error('No se pudo eliminar el personal');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar personal:', error);
      throw error;
    }
  }

  // Método para obtener personal por código
  static async getByCodigo(codigo) {
    try {
      if (!codigo) {
        throw new Error('Código es requerido');
      }


      // Primero obtener el personal básico
      const { data: personalData, error: personalError } = await supabase
        .from('personal')
        .select('*')
        .eq('codigo', codigo)
        .single();

      if (personalError) {
        if (personalError.code === 'PGRST116') {
          return null; // Personal no encontrado
        }
        console.error('Error al obtener personal:', personalError);
        throw new Error('No se pudo obtener el personal');
      }

      // Luego obtener los módulos por separado
      let modules = [];
      try {
        const { data: moduleData, error: moduleError } = await supabase
          .from('personal_modulo_permiso')
          .select(`
            sub_modulo_id,
            sub_modulos (
              id,
              name,
              module_id,
              modules (
                id,
                name
              )
            )
          `)
          .eq('personal_id', personalData.id);

        if (!moduleError && moduleData) {
          modules = moduleData.map(pmp => ({
            ...pmp.sub_modulos,
            modulos: pmp.sub_modulos.modules // Mapear modules como modulos para el frontend
          })).filter(Boolean);
        }
      } catch (moduleError) {
        console.error('Error al obtener módulos:', moduleError);
        // No lanzar error, continuar sin módulos
      }
      
      return {
        ...personalData,
        modules: modules
      };
    } catch (error) {
      console.error('Error al obtener personal por código:', error);
      throw new Error('No se pudo obtener el personal');
    }
  }

  // Método para establecer contraseña
  static async setPassword(id, password) {
    try {
      if (!id || !password) {
        throw new Error('ID del personal y contraseña son requeridos');
      }

      const bcrypt = require('bcryptjs');
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const { data, error } = await supabase
        .from('personal')
        .update({ 
          password: hashedPassword,
          is_active: true  // Activar el personal cuando establece contraseña
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error('No se pudo establecer la contraseña');
      }

      return data;
    } catch (error) {
      console.error('Error al establecer contraseña:', error);
      throw error;
    }
  }

  // Método para login de empleado
  static async loginEmployee(codigo, password) {
    try {
      if (!codigo || !password) {
        throw new Error('Código y contraseña son requeridos');
      }

      // Obtener personal por código
      const personal = await this.getByCodigo(codigo);

      if (!personal) {
        return {
          success: false,
          message: 'Código de empleado no válido'
        };
      }

      if (!personal.is_active) {
        return {
          success: false,
          message: 'Su cuenta está inactiva. Contacte al administrador.'
        };
      }

      if (!personal.password) {
        return {
          success: false,
          message: 'No tiene contraseña establecida'
        };
      }

      // Verificar contraseña
      const bcrypt = require('bcryptjs');
      const isPasswordValid = await bcrypt.compare(password, personal.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Contraseña incorrecta'
        };
      }

      // Generar token JWT
      const { generateToken } = require('../config/jwt');
      
      const tokenPayload = {
        id: personal.id,
        empresa_id: personal.empresa_id,
        type: 'employee'
      };

      const token = generateToken(tokenPayload);

      return {
        success: true,
        data: {
          personal: {
            id: personal.id,
            codigo: personal.codigo,
            first_name: personal.first_name,
            last_name: personal.last_name,
            empresa_id: personal.empresa_id,
            sucursal_id: personal.sucursal_id,
            is_active: personal.is_active,
            modules: personal.modules
          },
          token: token
        }
      };
    } catch (error) {
      console.error('Error en login de empleado:', error);
      return {
        success: false,
        message: 'Error en el login'
      };
    }
  }

  // Método para cambiar contraseña de empleado
  static async changePassword(id, currentPassword, newPassword) {
    try {
      if (!id || !currentPassword || !newPassword) {
        throw new Error('ID del personal, contraseña actual y nueva contraseña son requeridos');
      }

      // Obtener personal por ID
      const personal = await this.getById(id);

      if (!personal) {
        return {
          success: false,
          message: 'Personal no encontrado'
        };
      }

      if (!personal.password) {
        return {
          success: false,
          message: 'No tiene contraseña establecida'
        };
      }

      // Verificar contraseña actual
      const bcrypt = require('bcryptjs');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, personal.password);

      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: 'La contraseña actual es incorrecta'
        };
      }

      // Hash de la nueva contraseña
      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Actualizar contraseña
      const { data, error } = await supabase
        .from('personal')
        .update({ password: hashedNewPassword })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error('No se pudo cambiar la contraseña');
      }

      return {
        success: true,
        message: 'Contraseña cambiada exitosamente'
      };
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = Personal;
