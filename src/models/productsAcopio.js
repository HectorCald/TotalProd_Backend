const { supabase } = require('../config/supabase');

class productsAcopio {

  // Constructor para crear un producto
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.category_id = data.category_id;
    this.user_id = data.user_id;
    this.created_at = data.created_at;
  }

  // Método para obtener todos los productos
  static async getAll(userId) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('products_acopio')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error('No se pudo obtener los productos');
      }
      
      return data;
    } catch (error) {
      console.error('Error al obtener los productos:', error);
      throw new Error('No se pudo obtener los productos');
    }
  }

  // Obtener productos por categoría
  static async getByCategory(categoryId, userId) {
    try {
      if (!categoryId) {
        throw new Error('ID de la categoría es requerido');
      }
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('products_acopio')
        .select(`
          *,
          type_measure:type_measure_id (
            id,
            name,
            code
          ),
          category:category_id (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .order('name', { ascending: true });

      if (error) {
        throw new Error('No se pudo obtener los productos de la categoría');
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener productos por categoría:', error);
      throw error;
    }
  }

  // Nuevo método para paginación con búsqueda
  static async getAllPaginated(userId, { page, limit, offset, search, categoria, tipoMedida, ordenamiento }) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      let query = supabase
        .from('products_acopio')
        .select(`
          *,
          type_measure:type_measure_id (
            id,
            name,
            code
          ),
          category:category_id (
            id,
            name
          )
        `, { count: 'exact' })
        .eq('user_id', userId);

      // Aplicar filtro de búsqueda si existe
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        query = query.or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`);
      }

      // Aplicar filtro de categoría si existe
      if (categoria && categoria.trim()) {
        query = query.eq('category_id', categoria);
      } else if (categoria === '') {
        // Si categoria es string vacío, mostrar solo productos sin categoría
        query = query.is('category_id', null);
      }
      // Si categoria es null o undefined, no aplicar filtro (mostrar todos)

      // Aplicar filtro de tipo de medida si existe
      if (tipoMedida && tipoMedida.trim()) {
        query = query.eq('type_measure_id', tipoMedida);
      } else if (tipoMedida === '') {
        // Si tipoMedida es string vacío, mostrar solo productos sin tipo de medida
        query = query.is('type_measure_id', null);
      }
      // Si tipoMedida es null o undefined, no aplicar filtro (mostrar todos)

      // Aplicar ordenamiento
      let orderBy = 'name';
      let ascending = true;

      switch (ordenamiento) {
        case 'nombre_asc':
          orderBy = 'name';
          ascending = true;
          break;
        case 'nombre_desc':
          orderBy = 'name';
          ascending = false;
          break;
        case 'cantidad_asc':
          orderBy = 'quantity';
          ascending = true;
          break;
        case 'cantidad_desc':
          orderBy = 'quantity';
          ascending = false;
          break;
        default:
          orderBy = 'name';
          ascending = true;
      }

      // Aplicar paginación y ordenamiento
      query = query
        .order(orderBy, { ascending })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error('No se pudo obtener los productos');
      }

      
      return {
        products: data || [],
        total: count || 0
      };
    } catch (error) {
      console.error('Error al obtener los productos paginados:', error);
      throw new Error('No se pudo obtener los productos');
    }
  }

  // Crear un producto con sus lotes
  static async create(productData, lotesData, userId) {
    try {
      // Preparar datos para la base de datos
      const dbData = {
        name: productData.name,
        description: productData.description || null,
        quantity: productData.quantity || null,
        type_measure_id: productData.type_measure_id || null,
        category_id: productData.category_id || null,
        user_id: userId,
      };

      const { data: product, error: productError } = await supabase
        .from('products_acopio')
        .insert([dbData])
        .select();

      if (productError) {
        console.error('Error de Supabase al crear producto:', productError);
        throw new Error('No se pudo crear el producto');
      }

      if (!product || product.length === 0) {
        throw new Error('No se pudo crear el producto');
      }

      const productId = product[0].id;

      // Crear los lotes si existen
      if (lotesData && lotesData.length > 0) {
        const lotesToInsert = lotesData.map(lote => ({
          product_id: productId,
          num_lote: lote.num_lote,
          quantity: lote.quantity,
          date_entry: lote.date_entry || new Date().toISOString().split('T')[0],
          date_expiration: lote.date_expiration || null,
          proveedor_id: lote.proveedor_id || null
        }));

        const { error: lotesError } = await supabase
          .from('lotes_acopio')
          .insert(lotesToInsert);

        if (lotesError) {
          console.error('Error de Supabase al crear lotes:', lotesError);
          // No lanzamos error aquí, el producto ya se creó
        }
      }

      return product[0];
    } catch (error) {
      console.error('Error al crear el producto:', error);
      throw error;
    }
  }

  // Verificar si un producto tiene movimientos
  static async hasMovements(productId, userId) {
    try {
      if (!productId) {
        throw new Error('ID del producto es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('movimientos_acopio')
        .select('id')
        .eq('product_id', productId)
        .eq('user_id', userId)
        .limit(1);

      if (error) {
        console.error('Error de Supabase al verificar movimientos:', error);
        throw new Error('No se pudo verificar los movimientos');
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error al verificar movimientos:', error);
      throw error;
    }
  }

  // Eliminar un producto
  static async delete(id, userId) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Verificar si el producto tiene movimientos
      const hasMovements = await this.hasMovements(id, userId);
      if (hasMovements) {
        throw new Error('No se puede eliminar el producto porque tiene movimientos registrados');
      }

      // Primero eliminar los lotes asociados
      const { error: lotesError } = await supabase
        .from('lotes_acopio')
        .delete()
        .eq('product_id', id);

      if (lotesError) {
        console.error('Error al eliminar lotes:', lotesError);
        // Continuar con la eliminación del producto
      }

      // Luego eliminar el producto
      const { error } = await supabase
        .from('products_acopio')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo eliminar el producto');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
      throw error;
    }
  }

  // Actualizar un producto
  static async update(id, productData, lotesData, userId) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Obtener el producto actual para verificar si se está cambiando la unidad de medida
      const { data: currentProduct, error: currentError } = await supabase
        .from('products_acopio')
        .select('type_measure_id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (currentError) {
        throw new Error('No se pudo obtener el producto actual');
      }

      // Verificar si se está cambiando la unidad de medida
      const isChangingMeasure = currentProduct.type_measure_id !== productData.type_measure_id;
      
      if (isChangingMeasure) {
        // Verificar si el producto tiene movimientos
        const hasMovements = await this.hasMovements(id, userId);
        if (hasMovements) {
          throw new Error('No se puede cambiar la unidad de medida porque el producto tiene movimientos registrados');
        }
      }

      // Preparar datos para la base de datos
      const dbData = {
        name: productData.name,
        description: productData.description || null,
        quantity: productData.quantity || null,
        type_measure_id: productData.type_measure_id || null,
        category_id: productData.category_id || null
      };

      const { data, error } = await supabase
        .from('products_acopio')
        .update(dbData)
        .eq('id', id)
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo actualizar el producto');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar el producto');
      }

      // Actualizar lotes si se proporcionan
      if (lotesData !== undefined) {
        // Eliminar lotes existentes
        const { error: deleteLotesError } = await supabase
          .from('lotes_acopio')
          .delete()
          .eq('product_id', id);

        if (deleteLotesError) {
          console.error('Error al eliminar lotes existentes:', deleteLotesError);
        }

        // Crear nuevos lotes si existen
        if (lotesData && lotesData.length > 0) {
          const lotesToInsert = lotesData.map(lote => ({
            product_id: id,
            num_lote: lote.num_lote,
            quantity: lote.quantity,
            date_entry: lote.date_entry || new Date().toISOString().split('T')[0],
            date_expiration: lote.date_expiration || null,
            proveedor_id: lote.proveedor_id || null
          }));

          const { error: lotesError } = await supabase
            .from('lotes_acopio')
            .insert(lotesToInsert);

          if (lotesError) {
            console.error('Error de Supabase al crear lotes:', lotesError);
          }
        }
      }

      return data[0];
    } catch (error) {
      console.error('Error al actualizar el producto:', error);
      throw error;
    }
  }

  // Obtener un producto con sus lotes
  static async getByIdWithLotes(id, userId) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Obtener el producto con su tipo de medida y categoría
      const { data: product, error: productError } = await supabase
        .from('products_acopio')
        .select(`
          *,
          type_measure:type_measure_id (
            id,
            name,
            code
          ),
          category:category_id (
            id,
            name
          )
        `)
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (productError) {
        throw new Error('No se pudo obtener el producto');
      }

      return product;
    } catch (error) {
      console.error('Error al obtener el producto con lotes:', error);
      throw error;
    }
  }
}

module.exports = productsAcopio;
