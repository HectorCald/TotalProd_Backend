const { supabase } = require('../../config/supabase');

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
    this.branch_id = data.branch_id || data.sucu_id;
  }

  // Método para obtener todos los clientes de una sucursal
  static async getAll(branchId) {
    try {
      if (!branchId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('branch_id', branchId);

      if (error) {
        console.error('Error de Supabase en clients.getAll:', error);
        throw new Error(`No se pudo obtener los clientes: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error('No se pudo obtener los clientes');
    }
  }

  // Crear un cliente
  static async create(clientData, branchId) {
    try {
      
      // Preparar datos para la base de datos
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        description: clientData.description || null,
        total_orders: clientData.total_orders || 0,
        branch_id: branchId,
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
        throw new Error('No se pudo crear el cliente');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo crear el cliente');
      }
    } catch (error) {
      throw error;
    }
  }

  // Eliminar un cliente
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)

      if (error) {
        if (error.code === '23503' || (error.message && error.message.includes('foreign key'))) {
          throw new Error('No es posible eliminar el cliente porque está asociado a registros de movimientos o deudas existentes.');
        }
        throw new Error('No se pudo eliminar el cliente');
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar un cliente
  static async update(id, clientData) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      // Preparar datos para la base de datos
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        description: clientData.description || null,
        total_orders: clientData.total_orders || 0
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
        throw new Error('No se pudo actualizar el cliente');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo actualizar el cliente');
      }
    } catch (error) {
      throw error;
    }
  }

  // Obtener un cliente por ID
  static async getById(id) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error('No se pudo obtener el cliente');
      }

      if (!data) {
        throw new Error('Cliente no encontrado');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = clients;