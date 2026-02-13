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
    this.sucu_id = data.sucu_id;
  }

  // Método para obtener todos los proveedores de una sucursal
  static async getAll(sucuId) {
    try {
      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .eq('sucu_id', sucuId);

      if (error) {
        throw new Error('No se pudo obtener los proveedores');
      }
      
      return data;
    } catch (error) {
      console.error('Error al obtener los proveedores:', error);
      throw new Error('No se pudo obtener los proveedores');
    }
  }

  // Crear un proveedor
  static async create(proveedorData, sucuId) {
    try {
      
      // Preparar datos para la base de datos
      const dbData = {
        name: proveedorData.name,
        phone: proveedorData.phone || null,
        description: proveedorData.description || null,
        total_orders: 0,
        sucu_id: sucuId,
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

  // Eliminar un proveedor
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del proveedor es requerido');
      }

      const { error } = await supabase
        .from('proveedores')
        .delete()
        .eq('id', id)

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

  // Actualizar un proveedor
  static async update(id, proveedorData) {
    try {
      if (!id) {
        throw new Error('ID del proveedor es requerido');
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

  // Obtener un proveedor por ID
  static async getById(id) {
    try {
      if (!id) {
        throw new Error('ID del proveedor es requerido');
      }

      const { data, error } = await supabase
        .from('proveedores')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener el proveedor');
      }

      if (!data) {
        throw new Error('Proveedor no encontrado');
      }

      return data;
    } catch (error) {
      console.error('Error al obtener el proveedor:', error);
      throw error;
    }
  }
}

module.exports = proveedores;
