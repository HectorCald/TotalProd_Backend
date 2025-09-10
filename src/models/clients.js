const { supabase } = require('../config/supabase');

class clients {

  // Constructor para crear un cliente
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
        .from('clients')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error('No se pudo obtener los clientes');
      }
      
      return data;
    } catch (error) {
      console.error('Error al obtener los clientes:', error);
      throw new Error('No se pudo obtener los clientes');
    }
  }

  // Nuevo método para paginación con búsqueda
  static async getAllPaginated(userId, { page, limit, offset, search }) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      let query = supabase
        .from('clients')
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
        throw new Error('No se pudo obtener los clientes');
      }
      
      return {
        clients: data || [],
        total: count || 0
      };
    } catch (error) {
      console.error('Error al obtener los clientes paginados:', error);
      throw new Error('No se pudo obtener los clientes');
    }
  }

  // Crear un cliente
  static async create(clientData, userId) {
    try {
      
      // Preparar datos para la base de datos
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        description: clientData.description || null,
        total_orders: 0,
        user_id: userId,
      };

      // Si hay location, usarla directamente
      if (clientData.location) {
        dbData.location = clientData.location;
      }

      const { data, error } = await supabase
        .from('clients')
        .insert([dbData])
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo crear el cliente');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo crear el cliente');
      }
    } catch (error) {
      console.error('Error al crear el cliente:', error);
      throw error;
    }
  }

  // Eliminar un cliente
  static async delete(id, userId) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo eliminar el cliente');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar el cliente:', error);
      throw error;
    }
  }

  // Actualizar un cliente
  static async update(id, clientData, userId) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Preparar datos para la base de datos
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        description: clientData.description || null
      };

      // Si hay location, usarla directamente
      if (clientData.location) {
        dbData.location = clientData.location;
      }

      const { data, error } = await supabase
        .from('clients')
        .update(dbData)
        .eq('id', id)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo actualizar el cliente');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo actualizar el cliente');
      }
    } catch (error) {
      console.error('Error al actualizar el cliente:', error);
      throw error;
    }
  }
}

module.exports = clients;
