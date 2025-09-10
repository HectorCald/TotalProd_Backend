const { supabase } = require('../config/supabase');

class proveedores {

  // Constructor para crear un proveedor
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.phone = data.phone;
    this.location = data.location;
    this.description = data.description;
    this.total_orders = data.total_orders;
    this.created_at = data.created_at;
    this.user_id = data.user_id;
  }

  // Método para obtener todos los clientes
  static async getAll(userId) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error('No se pudo obtener los proveedores');
      }
      
      return data;
    } catch (error) {
      console.error('Error al obtener los proveedores:', error);
      throw new Error('No se pudo obtener los proveedores');
    }
  }

  // Nuevo método para paginación con búsqueda
  static async getAllPaginated(userId, { page, limit, offset, search }) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      let query = supabase
        .from('proveedores')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Aplicar filtro de búsqueda si existe
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(`name.ilike.${searchTerm},phone.ilike.${searchTerm}`);
      }

      // Aplicar paginación y ordenamiento
      query = query
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error('No se pudo obtener los proveedores');
      }
      
      return {
        proveedores: data || [],
        total: count || 0
      };
    } catch (error) {
      console.error('Error al obtener los proveedores paginados:', error);
      throw new Error('No se pudo obtener los proveedores');
    }
  }

  // Crear un cliente
  static async create(proveedorData, userId) {
    try {
      
      // Preparar datos para la base de datos
      const dbData = {
        name: proveedorData.name,
        phone: proveedorData.phone || null,
        description: proveedorData.description || null,
        total_orders: 0,
        user_id: userId,
      };

      // Si hay location, usarla directamente
      if (proveedorData.location) {
        dbData.location = proveedorData.location;
      }

      const { data, error } = await supabase
          .from('proveedores')
        .insert([dbData])
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo crear el proveedor');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo crear el proveedor');
      }
    } catch (error) {
      console.error('Error al crear el proveedor:', error);
      throw error;
    }
  }

  // Eliminar un cliente
  static async delete(id, userId) {
    try {
      if (!id) {
        throw new Error('ID del proveedor es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { error } = await supabase
        .from('proveedores')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo eliminar el proveedor');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar el proveedor:', error);
      throw error;
    }
  }

  // Actualizar un cliente
  static async update(id, proveedorData, userId) {
    try {
      if (!id) {
        throw new Error('ID del proveedor es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Preparar datos para la base de datos
      const dbData = {
        name: proveedorData.name,
        phone: proveedorData.phone || null,
        description: proveedorData.description || null
      };

      // Si hay location, usarla directamente
      if (proveedorData.location) {
        dbData.location = proveedorData.location;
      }

      const { data, error } = await supabase
          .from('proveedores')
        .update(dbData)
        .eq('id', id)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo actualizar el proveedor');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo actualizar el proveedor');
      }
    } catch (error) {
      console.error('Error al actualizar el proveedor:', error);
      throw error;
    }
  }
}

module.exports = proveedores;
