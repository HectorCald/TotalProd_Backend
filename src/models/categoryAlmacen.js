const { supabase } = require('../config/supabase');

class categoryAlmacen {

  // Constructor para crear una categoría
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.created_at = data.created_at;
  }

  // Método para obtener todas las categorías de una empresa
  static async getAll(empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const { data, error } = await supabase
        .from('category_almacen')
        .select('*')
        .eq('empresa_id', empresaId)
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

  // Verificar si ya existe una categoría con el mismo nombre (case insensitive)
  static async checkNameExists(name, empresaId, excludeId = null) {
    try {
      if (!name || !empresaId) {
        return false;
      }

      let query = supabase
        .from('category_almacen')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('name', name.trim());

      // Si se está editando, excluir el ID actual
      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        console.error('Error al verificar nombre de categoría:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error al verificar nombre de categoría:', error);
      return false;
    }
  }

  // Crear una categoría
  static async create(categoryData, empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // Verificar si ya existe una categoría con el mismo nombre
      const nameExists = await this.checkNameExists(categoryData.name, empresaId);
      if (nameExists) {
        throw new Error('Ya existe una categoría con este nombre');
      }

      const dbData = {
        name: categoryData.name,
        empresa_id: empresaId
      };

      const { data, error } = await supabase
        .from('category_almacen')
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
  static async update(id, categoryData) {
    try {
      if (!id) {
        throw new Error('ID de la categoría es requerido');
      }

      // Primero obtener la empresa_id de la categoría actual
      const { data: currentCategory, error: fetchError } = await supabase
        .from('category_almacen')
        .select('empresa_id')
        .eq('id', id)
        .single();

      if (fetchError || !currentCategory) {
        throw new Error('Categoría no encontrada');
      }

      // Verificar si ya existe una categoría con el mismo nombre (excluyendo la actual)
      const nameExists = await this.checkNameExists(categoryData.name, currentCategory.empresa_id, id);
      if (nameExists) {
        throw new Error('Ya existe una categoría con este nombre');
      }

      const { data, error } = await supabase
        .from('category_almacen')
        .update(categoryData)
        .eq('id', id)
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
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID de la categoría es requerido');
      }

      // Primero verificar si la categoría tiene productos asignados
      const { data: products, error: productsError } = await supabase
        .from('products_almacen')
        .select('id')
        .eq('category_id', id)
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
        .from('category_almacen')
        .delete()
        .eq('id', id);

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

module.exports = categoryAlmacen;
