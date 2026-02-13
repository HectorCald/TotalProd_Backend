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
    this.sucu_id = data.sucu_id;
  }

  // Método para obtener todos los clientes de una sucursal (solo datos de la tabla clients).
  static async getAll(sucuId) {
    try {
      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('sucu_id', sucuId);

      if (error) {
        throw new Error('No se pudo obtener los clientes');
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener los clientes:', error);
      throw new Error('No se pudo obtener los clientes');
    }
  }

  // Obtener la ubicación de un cliente: la de la tabla clients si existe;
  // si no, la del último movimiento (movimientos_almacen.ubicacion) donde cliente_id = id y ubicacion no es null.
  static async getLocation(clientId) {
    try {
      if (!clientId) {
        return { location: null };
      }

      const { data: client, error: errClient } = await supabase
        .from('clients')
        .select('location')
        .eq('id', clientId)
        .single();

      if (errClient || !client) {
        return { location: null };
      }

      if (client.location != null) {
        return { location: client.location };
      }

      const { data: mov, error: errMov } = await supabase
        .from('movimientos_almacen')
        .select('ubicacion')
        .eq('cliente_id', clientId)
        .not('ubicacion', 'is', null)
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errMov || !mov || mov.ubicacion == null) {
        return { location: null };
      }

      return { location: mov.ubicacion };
    } catch (error) {
      console.error('Error al obtener ubicación del cliente:', error);
      return { location: null };
    }
  }

  // Crear un cliente
  static async create(clientData, sucuId) {
    try {
      
      // Preparar datos para la base de datos
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        description: clientData.description || null,
        total_orders: clientData.total_orders || 0,
        sucu_id: sucuId,
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
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener el cliente');
      }

      if (!data) {
        throw new Error('Cliente no encontrado');
      }

      return data;
    } catch (error) {
      console.error('Error al obtener el cliente:', error);
      throw error;
    }
  }
}

module.exports = clients;
