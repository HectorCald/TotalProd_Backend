const { supabase } = require('../config/supabase');

class pricesTypes {

  // Constructor para crear un tipo de precio
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.created_at = data.created_at;
  }

  // Método para obtener todos los tipos de precios de un usuario
  static async getAll(userId) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('prices_types')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los tipos de precios');
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener los tipos de precios:', error);
      throw new Error('No se pudo obtener los tipos de precios');
    }
  }

  // Crear un tipo de precio
  static async create(priceTypeData, userId) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const dbData = {
        name: priceTypeData.name,
        description: priceTypeData.description || null,
        user_id: userId
      };

      const { data, error } = await supabase
        .from('prices_types')
        .insert([dbData])
        .select();

      if (error) {
        console.error('Error de Supabase al crear tipo de precio:', error);
        throw new Error('No se pudo crear el tipo de precio');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo crear el tipo de precio');
      }

      return data[0];
    } catch (error) {
      console.error('Error al crear el tipo de precio:', error);
      throw error;
    }
  }

  // Actualizar un tipo de precio
  static async update(id, priceTypeData, userId) {
    try {
      if (!id) {
        throw new Error('ID del tipo de precio es requerido');
      }
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('prices_types')
        .update(priceTypeData)
        .eq('id', id)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo actualizar el tipo de precio');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar el tipo de precio');
      }

      return data[0];
    } catch (error) {
      console.error('Error al actualizar el tipo de precio:', error);
      throw error;
    }
  }

  // Eliminar un tipo de precio
  static async delete(id, userId) {
    try {
      if (!id) {
        throw new Error('ID del tipo de precio es requerido');
      }
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Primero verificar si el tipo de precio tiene productos asignados
      const { data: products, error: productsError } = await supabase
        .from('price_product')
        .select('id')
        .eq('price_type_id', id)
        .eq('user_id', userId)
        .limit(1);

      if (productsError) {
        console.error('Error al verificar productos:', productsError);
        throw new Error('No se pudo verificar si el tipo de precio tiene productos');
      }

      if (products && products.length > 0) {
        throw new Error('No se puede eliminar el tipo de precio porque tiene productos asignados');
      }

      // Si no tiene productos, proceder con la eliminación
      const { error } = await supabase
        .from('prices_types')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo eliminar el tipo de precio');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar el tipo de precio:', error);
      throw error;
    }
  }
}

module.exports = pricesTypes;
