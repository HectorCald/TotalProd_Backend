const { supabase } = require('../config/supabase');

class productsAcopio {

  // Constructor para crear un producto
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.category_id = data.category_id;
    this.empresa_id = data.empresa_id;
    this.created_at = data.created_at;
  }

  // Método para obtener un producto por ID con recetas
  static async getById(id) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      const { data, error } = await supabase
        .from('products_acopio')
        .select(`
          *,
          category:category_id (
            id,
            name
          ),
          type_measure:type_measure_id (
            id,
            name,
            code,
            code_menor,
            value
          ),
          recetas_acopio (
            id,
            description,
            recetas_acopio_detalle (
              id,
              cantidad,
              products_acopio:producto_acopio_id (
                id,
                name,
                quantity,
                type_measure:type_measure_id (
                  id,
                  name,
                  code,
                  code_menor,
                  value
                )
              )
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Producto no encontrado
        }
        throw new Error('No se pudo obtener el producto');
      }

      return data;
    } catch (error) {
      console.error('Error al obtener el producto:', error);
      throw error;
    }
  }

  // Método para obtener todos los productos
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
        .from('products_acopio')
        .select(`
          *,
          category:category_id (
            id,
            name
          ),
          type_measure:type_measure_id (
            id,
            name,
            code,
            code_menor,
            value
          ),
          recetas_acopio (
            id,
            description,
            recetas_acopio_detalle (
              id,
              cantidad,
              products_acopio:producto_acopio_id (
                id,
                name,
                quantity,
                type_measure:type_measure_id (
                  id,
                  name,
                  code
                )
              )
            )
          )
        `)
        .in('empresa_id', empresaIds)
        .order('name', { ascending: true });

      if (error) {
        throw new Error('No se pudo obtener los productos');
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener los productos:', error);
      throw new Error('No se pudo obtener los productos');
    }
  }

  // Crear un producto con receta opcional
  static async create(productData, empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // Validación: evitar nombres duplicados por empresa (case-insensitive)
      const nombreProducto = (productData.name || '').trim();
      if (!nombreProducto) {
        throw new Error('El nombre del producto es requerido');
      }

      const { data: existentes, error: errorExistentes } = await supabase
        .from('products_acopio')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('name', nombreProducto)
        .limit(1);

      if (errorExistentes) {
        console.error('Error verificando duplicados de producto:', errorExistentes);
        throw new Error('No se pudo verificar si el producto ya existe');
      }

      if (existentes && existentes.length > 0) {
        throw new Error('Ya existe un producto con el mismo nombre en esta empresa');
      }

      // 1. Crear el producto principal
      const dbProductData = {
        name: nombreProducto,
        description: productData.description || null,
        quantity: productData.quantity !== undefined ? productData.quantity : 0,
        type_measure_id: productData.type_measure_id || null,
        category_id: productData.category_id || null,
        empresa_id: empresaId,
        stock_minimo: productData.stock_minimo || 0
      };

      const { data: product, error: productError } = await supabase
        .from('products_acopio')
        .insert([dbProductData])
        .select();

      if (productError) {
        console.error('Error de Supabase al crear producto:', productError);
        throw new Error('No se pudo crear el producto');
      }

      if (!product || product.length === 0) {
        throw new Error('No se pudo crear el producto');
      }

      const productId = product[0].id;

      // 2. Crear la receta si existe
      if (productData.receta && productData.receta.productos && productData.receta.productos.length > 0) {
        // Crear la receta principal
        const { data: receta, error: recetaError } = await supabase
          .from('recetas_acopio')
          .insert([{
            producto_acopio_id: productId,
            description: productData.receta.descripcion || null
          }])
          .select();

        if (recetaError) {
          console.error('Error al crear receta:', recetaError);
          // No lanzar error aquí, solo log
        } else if (receta && receta.length > 0) {
          const recetaId = receta[0].id;

          // Crear los detalles de la receta
          const recetaDetalleInserts = productData.receta.productos.map(detalle => ({
            receta_acopio_id: recetaId,
            producto_acopio_id: detalle.producto_acopio_id,
            cantidad: detalle.cantidad
          }));

          const { error: recetaDetalleError } = await supabase
            .from('recetas_acopio_detalle')
            .insert(recetaDetalleInserts);

          if (recetaDetalleError) {
            console.error('Error al crear detalles de receta:', recetaDetalleError);
            // No lanzar error aquí, solo log
          }
        }
      }

      return product[0];
    } catch (error) {
      console.error('Error al crear el producto:', error);
      throw error;
    }
  }

  // Eliminar un producto
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      // Verificar si el producto tiene movimientos
      const hasMovements = await this.hasMovements(id);
      if (hasMovements) {
        throw new Error('No se puede eliminar el producto porque tiene movimientos registrados');
      }

      // 1. Primero eliminar los detalles de recetas asociados
      const { data: recetas, error: errorRecetasQuery } = await supabase
        .from('recetas_acopio')
        .select('id')
        .eq('producto_acopio_id', id);

      if (errorRecetasQuery) {
        console.error('Error obteniendo recetas:', errorRecetasQuery);
        throw new Error('No se pudieron obtener las recetas del producto');
      }

      // 2. Eliminar detalles de recetas si existen
      if (recetas && recetas.length > 0) {
        const recetaIds = recetas.map(r => r.id);
        const { error: errorDetalles } = await supabase
          .from('recetas_acopio_detalle')
          .delete()
          .in('receta_acopio_id', recetaIds);

        if (errorDetalles) {
          console.error('Error al eliminar detalles de recetas:', errorDetalles);
          throw new Error('No se pudieron eliminar los detalles de las recetas');
        }

        // 3. Eliminar las recetas
        const { error: errorRecetas } = await supabase
          .from('recetas_acopio')
          .delete()
          .eq('producto_acopio_id', id);

        if (errorRecetas) {
          console.error('Error al eliminar recetas:', errorRecetas);
          throw new Error('No se pudieron eliminar las recetas');
        }
      }

      // 4. Los lotes se eliminan automáticamente por CASCADE si existen

      // 5. Finalmente eliminar el producto
      const { error } = await supabase
        .from('products_acopio')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error de Supabase:', error);
        
        // Verificar si es un error de foreign key constraint
        if (error.code === '23503') {
          if (error.message.includes('recetas_acopio_detalle')) {
            throw new Error('No se puede eliminar este producto porque está siendo utilizado como ingrediente en recetas de otros productos. Primero elimine o modifique las recetas que contienen este producto.');
          } else if (error.message.includes('foreign key constraint')) {
            throw new Error('No se puede eliminar este producto porque está siendo utilizado en otras partes del sistema.');
          }
        }
        
        throw new Error('No se pudo eliminar el producto');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar el producto:', error);
      throw error;
    }
  }

  // Actualizar un producto
  static async update(id, productData) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      // Obtener el producto actual para verificar si se está cambiando la unidad de medida
      const { data: currentProduct, error: currentError } = await supabase
        .from('products_acopio')
        .select('type_measure_id')
        .eq('id', id)
        .single();

      if (currentError) {
        throw new Error('No se pudo obtener el producto actual');
      }

      // Verificar si se está cambiando la unidad de medida
      const isChangingMeasure = currentProduct.type_measure_id !== productData.type_measure_id;

      if (isChangingMeasure) {
        // Verificar si el producto tiene movimientos
        const hasMovements = await this.hasMovements(id);
        if (hasMovements) {
          throw new Error('No se puede cambiar la unidad de medida porque el producto tiene movimientos registrados');
        }
      }

      // Preparar datos para la base de datos
      const dbData = {
        name: productData.name,
        description: productData.description || null,
        quantity: productData.quantity !== undefined ? productData.quantity : 0,
        type_measure_id: productData.type_measure_id || null,
        category_id: productData.category_id || null,
        stock_minimo: productData.stock_minimo || 0
      };

      const { data, error } = await supabase
        .from('products_acopio')
        .update(dbData)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo actualizar el producto');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar el producto');
      }


      // Actualizar receta si se proporciona
      if (productData.receta !== undefined) {
        // Eliminar receta existente y sus detalles
        const { data: existingRecetas } = await supabase
          .from('recetas_acopio')
          .select('id')
          .eq('producto_acopio_id', id);

        if (existingRecetas && existingRecetas.length > 0) {
          const recetaId = existingRecetas[0].id;

          // Eliminar detalles de receta
          await supabase
            .from('recetas_acopio_detalle')
            .delete()
            .eq('receta_acopio_id', recetaId);

          // Eliminar receta
          await supabase
            .from('recetas_acopio')
            .delete()
            .eq('id', recetaId);
        }

        // Crear nueva receta si tiene datos
        if (productData.receta && (productData.receta.descripcion || (productData.receta.productos && productData.receta.productos.length > 0))) {
          const { data: newReceta, error: recetaError } = await supabase
            .from('recetas_acopio')
            .insert({
              producto_acopio_id: id,
              description: productData.receta.descripcion || null
            })
            .select();

          if (recetaError) {
            console.error('Error creando receta:', recetaError);
            throw new Error('Error al actualizar la receta');
          }

          const recetaId = newReceta[0].id;

          // Crear detalles de receta si existen
          if (productData.receta.productos && productData.receta.productos.length > 0) {
            const detalles = productData.receta.productos.map(producto => ({
              receta_acopio_id: recetaId,
              producto_acopio_id: producto.producto_acopio_id,
              cantidad: parseFloat(producto.cantidad) || 0
            }));

            const { error: detallesError } = await supabase
              .from('recetas_acopio_detalle')
              .insert(detalles);

            if (detallesError) {
              console.error('Error creando detalles de receta:', detallesError);
              throw new Error('Error al actualizar los detalles de la receta');
            }
          }
        }
      }

      return data[0];
    } catch (error) {
      console.error('Error al actualizar el producto:', error);
      throw error;
    }
  }




  
  // Obtener productos por categoría
  static async getByCategory(categoryId) {
    try {
      if (!categoryId) {
        throw new Error('ID de la categoría es requerido');
      }

      const { data, error } = await supabase
        .from('products_acopio')
        .select(`
          *,
          type_measure:type_measure_id (
            id,
            name,
            code,
            code_menor,
            value
          ),
          category:category_id (
            id,
            name
          )
        `)
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

  // Verificar si un producto tiene movimientos
  static async hasMovements(productId) {
    try {
      if (!productId) {
        throw new Error('ID del producto es requerido');
      }

      const { data, error } = await supabase
        .from('movimientos_acopio')
        .select('id')
        .eq('product_id', productId)
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

  
}

module.exports = productsAcopio;
