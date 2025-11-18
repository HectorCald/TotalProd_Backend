const { supabase } = require('../config/supabase');

class pricesTypes {

  // Constructor para crear un tipo de precio
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.created_at = data.created_at;
  }

  // Método para obtener todos los tipos de precios de una empresa y empresas asociadas
  static async getAll(empresaId, empresasAsociadasIds = []) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // Construir array de IDs de empresas (empresa actual + asociadas)
      const empresaIds = [empresaId];
      if (Array.isArray(empresasAsociadasIds) && empresasAsociadasIds.length > 0) {
        empresaIds.push(...empresasAsociadasIds);
      }

      const { data, error } = await supabase
        .from('prices_types')
        .select('*')
        .in('empresa_id', empresaIds)
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
  static async create(priceTypeData, empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const dbData = {
        name: priceTypeData.name,
        description: priceTypeData.description || null,
        empresa_id: empresaId
      };

      const { data, error } = await supabase
        .from('prices_types')
        .insert([dbData])
        .select();

      if (error) {
        console.error('Error de Supabase al crear tipo de precio:', error);
        // Manejar específicamente el error de duplicación por empresa
        if (error.code === '23505' && error.constraint === 'prices_types_empresa_name_unique') {
          throw new Error(`Ya existe un tipo de precio con el nombre "${priceTypeData.name}" en esta empresa`);
        }
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
  static async update(id, priceTypeData) {
    try {
      if (!id) {
        throw new Error('ID del tipo de precio es requerido');
      }

      const { data, error } = await supabase
        .from('prices_types')
        .update(priceTypeData)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        // Manejar específicamente el error de duplicación por empresa
        if (error.code === '23505' && error.constraint === 'prices_types_empresa_name_unique') {
          throw new Error(`Ya existe un tipo de precio con el nombre "${priceTypeData.name}" en esta empresa`);
        }
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
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del tipo de precio es requerido');
      }

      // Primero verificar cuántos tipos de precio tiene la empresa
      const { data: allPrices, error: countError } = await supabase
        .from('prices_types')
        .select('id')
        .eq('empresa_id', (await supabase
          .from('prices_types')
          .select('empresa_id')
          .eq('id', id)
          .single()
        ).data.empresa_id);

      if (countError) {
        console.error('Error al contar tipos de precio:', countError);
        throw new Error('No se pudo verificar la cantidad de tipos de precio');
      }

      if (!allPrices || allPrices.length <= 1) {
        throw new Error('No se puede eliminar el tipo de precio. Debe haber al menos un tipo de precio en el sistema');
      }

      // Verificar si el tipo de precio tiene productos asignados
      const { data: products, error: productsError } = await supabase
        .from('price_product')
        .select('id')
        .eq('price_id', id)
        .limit(1);

      if (productsError) {
        console.error('Error al verificar productos:', productsError);
        throw new Error('No se pudo verificar si el tipo de precio tiene productos');
      }

      if (products && products.length > 0) {
        throw new Error('No se puede eliminar el tipo de precio porque tiene productos asignados');
      }

      // Si no tiene productos y hay más de uno, proceder con la eliminación
      const { error } = await supabase
        .from('prices_types')
        .delete()
        .eq('id', id);

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

  // Obtener precios por sucursal
  static async getBySucursalId(sucursalId) {
    try {
      if (!sucursalId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const { data, error } = await supabase
        .from('sucursal_precios')
        .select(`
          precio_id,
          prices_types:precio_id (
            id,
            name,
            description
          )
        `)
        .eq('sucursal_id', sucursalId);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los precios de la sucursal');
      }

      // Mapear los resultados para devolver solo los datos del precio
      const precios = (data || []).map(item => item.prices_types).filter(Boolean);

      return precios;
    } catch (error) {
      console.error('Error al obtener los precios de la sucursal:', error);
      throw error;
    }
  }
}

module.exports = pricesTypes;
