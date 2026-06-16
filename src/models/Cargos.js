const { supabase } = require('../config/supabase');

class Cargos {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.created_at = data.created_at;
    this.modules = data.modules || [];
  }

  // Obtener todos los cargos
  static async getAll(empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const { data, error } = await supabase
        .from('cargos')
        .select(`
          *,
          cargo_sub_modulo (
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
          )
        `)
        .eq('empresa_id', empresaId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los cargos');
      }

      // Procesar los datos para incluir los submódulos de manera más limpia
      const processedData = (data || []).map(cargo => {
        const modules = cargo.cargo_sub_modulo?.map(csm => ({
          ...csm.sub_modulos,
          modulos: csm.sub_modulos?.modules // Manteniendo la misma estructura que en Personal
        })).filter(Boolean) || [];

        return {
          ...cargo,
          modules: modules
        };
      });

      return processedData;
    } catch (error) {
      console.error('Error al obtener los cargos:', error);
      throw new Error('No se pudo obtener los cargos');
    }
  }

  // Obtener un cargo por ID
  static async getById(id) {
    try {
      if (!id) throw new Error('ID del cargo es requerido');

      const { data, error } = await supabase
        .from('cargos')
        .select(`
          *,
          cargo_sub_modulo (
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
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error('No se pudo obtener el cargo');
      }

      const modules = data.cargo_sub_modulo?.map(csm => ({
        ...csm.sub_modulos,
        modulos: csm.sub_modulos?.modules
      })).filter(Boolean) || [];

      return {
        ...data,
        modules: modules
      };
    } catch (error) {
      console.error('Error al obtener el cargo por ID:', error);
      throw new Error('No se pudo obtener el cargo');
    }
  }

  // Crear un cargo
  static async create(cargoData, empresaId) {
    try {
      const { name, description, modules = [] } = cargoData;

      if (!name) {
        throw new Error('El nombre del cargo es requerido');
      }
      
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // Crear el cargo
      const { data: newCargo, error } = await supabase
        .from('cargos')
        .insert([{
          name,
          description: description || null,
          empresa_id: empresaId
        }])
        .select()
        .single();

      if (error) {
        console.error('Error de Supabase al crear cargo:', error);
        // Manejar específicamente error de duplicación si lo hubiera
        if (error.code === '23505' && error.constraint === 'cargos_empresa_name_unique') {
          throw new Error(`Ya existe un cargo con el nombre "${name}" en esta empresa`);
        } else if (error.code === '23505') {
          throw new Error(`Ya existe un cargo con el nombre "${name}"`);
        }
        throw new Error('No se pudo crear el cargo');
      }

      // Crear relaciones con submódulos si existen
      if (modules && modules.length > 0) {
        const cargoModuloData = modules.map(moduleId => ({
          cargo_id: newCargo.id,
          sub_modulo_id: moduleId
        }));

        const { error: moduleError } = await supabase
          .from('cargo_sub_modulo')
          .insert(cargoModuloData);

        if (moduleError) {
          console.error('Error al insertar submódulos del cargo:', moduleError);
          // No lanzamos error para no interrumpir, pero se hace un log
        }
      }

      // Devolver cargo completo
      return await this.getById(newCargo.id);
    } catch (error) {
      console.error('Error al crear el cargo:', error);
      throw error;
    }
  }

  // Actualizar un cargo
  static async update(id, cargoData) {
    try {
      const { name, description, modules } = cargoData;

      if (!id) {
        throw new Error('ID del cargo es requerido');
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      // Solo actualiza campos si hay alguno
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('cargos')
          .update(updateData)
          .eq('id', id);

        if (error) {
          console.error('Error de Supabase al actualizar cargo:', error);
          if (error.code === '23505') {
            throw new Error(`Ya existe un cargo con ese nombre`);
          }
          throw new Error('No se pudo actualizar el cargo');
        }
      }

      // Actualizar relaciones con submódulos
      if (modules !== undefined) {
        // 1. Eliminar relaciones existentes
        const { error: deleteError } = await supabase
          .from('cargo_sub_modulo')
          .delete()
          .eq('cargo_id', id);

        if (deleteError) {
          console.error('Error al limpiar submódulos del cargo:', deleteError);
        }

        // 2. Crear nuevas relaciones
        if (modules.length > 0) {
          const cargoModuloData = modules.map(moduleId => ({
            cargo_id: id,
            sub_modulo_id: moduleId
          }));

          const { error: moduleError } = await supabase
            .from('cargo_sub_modulo')
            .insert(cargoModuloData);

          if (moduleError) {
            console.error('Error al insertar nuevos submódulos del cargo:', moduleError);
          }
        }
      }

      return await this.getById(id);
    } catch (error) {
      console.error('Error al actualizar el cargo:', error);
      throw error;
    }
  }

  // Eliminar un cargo
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del cargo es requerido');
      }

      // Primero eliminar relaciones de módulos (aunque hay cascade delete en SQL, es buena práctica si falla)
      const { error: moduleError } = await supabase
        .from('cargo_sub_modulo')
        .delete()
        .eq('cargo_id', id);

      if (moduleError) {
        console.error('Error al eliminar relaciones de submódulos:', moduleError);
      }

      // Luego eliminar el cargo
      const { error } = await supabase
        .from('cargos')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error de Supabase al eliminar cargo:', error);
        throw new Error('No se pudo eliminar el cargo');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar el cargo:', error);
      throw error;
    }
  }
}

module.exports = Cargos;
