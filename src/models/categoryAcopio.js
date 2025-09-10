const { supabase } = require('../config/supabase');

class categoryAcopio {

  // Constructor para crear una categoría
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.created_at = data.created_at;
  }

  // Método para obtener todas las categorías de un usuario
  static async getAll(userId) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('category_acopio')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener las categorías');
      }

      
      // Por ahora, devolver las categorías sin conteo para que funcione
      const categoriesWithCount = (data || []).map(category => ({
        ...category,
        products_count: 0 // Temporalmente en 0
      }));
      
      return categoriesWithCount;
    } catch (error) {
      console.error('Error al obtener las categorías:', error);
      throw new Error('No se pudo obtener las categorías');
    }
  }

  // Crear una categoría
  static async create(categoryData, userId) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const dbData = {
        name: categoryData.name,
        user_id: userId
      };

      const { data, error } = await supabase
        .from('category_acopio')
        .insert([dbData])
        .select();

      if (error) {
        console.error('Error de Supabase al crear categoría:', error);
        throw new Error('No se pudo crear la categoría');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo crear la categoría');
      }

      return data[0];
    } catch (error) {
      console.error('Error al crear la categoría:', error);
      throw error;
    }
  }

  // Actualizar una categoría
  static async update(id, categoryData, userId) {
    try {
      if (!id) {
        throw new Error('ID de la categoría es requerido');
      }
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('category_acopio')
        .update(categoryData)
        .eq('id', id)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo actualizar la categoría');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar la categoría');
      }

      return data[0];
    } catch (error) {
      console.error('Error al actualizar la categoría:', error);
      throw error;
    }
  }

  // Eliminar una categoría
  static async delete(id, userId) {
    try {
      if (!id) {
        throw new Error('ID de la categoría es requerido');
      }
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Primero verificar si la categoría tiene productos asignados
      const { data: products, error: productsError } = await supabase
        .from('products_acopio')
        .select('id')
        .eq('category_id', id)
        .eq('user_id', userId)
        .limit(1);

      if (productsError) {
        console.error('Error al verificar productos:', productsError);
        throw new Error('No se pudo verificar si la categoría tiene productos');
      }

      if (products && products.length > 0) {
        throw new Error('No se puede eliminar la categoría porque tiene productos asignados');
      }

      // Si no tiene productos, proceder con la eliminación
      const { error } = await supabase
        .from('category_acopio')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo eliminar la categoría');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar la categoría:', error);
      throw error;
    }
  }
}

module.exports = categoryAcopio;
