const { supabase } = require('../config/supabase');

class clients {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.phone = data.phone;
    this.location = data.location;
    this.total_orders = data.total_orders;
    this.created_at = data.created_at;
  }

  static async getAll() {
    try {
      const { data, error } = await supabase.from('clients').select('*');
      if (error) {
        throw new Error('No se pudo obtener los clientes');
      }
      
      return data;
    } catch (error) {
      console.error('Error al obtener los clientes:', error);
      throw new Error('No se pudo obtener los clientes');
    }
  }

  static async create(clientData) {
    try {
      console.log('🔍 MODEL CREATE - Datos recibidos:', clientData);
      
      // Preparar datos para la base de datos
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        total_orders: 0
      };

      // Si hay location, usarla directamente
      if (clientData.location) {
        dbData.location = clientData.location;
        console.log('🔍 MODEL CREATE - location agregada:', clientData.location);
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

  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

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

  static async update(id, clientData) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      // Preparar datos para la base de datos
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null
      };

      // Si hay location, usarla directamente
      if (clientData.location) {
        dbData.location = clientData.location;
      }

      const { data, error } = await supabase
        .from('clients')
        .update(dbData)
        .eq('id', id)
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
