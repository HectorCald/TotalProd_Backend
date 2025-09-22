const { supabase } = require('../config/supabase');

class productsAlmacen {

  // Constructor para crear un producto
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.stock = data.stock;
    this.codigo_barras = data.codigo_barras;
    this.category_id = data.category_id;
    this.description = data.description;
    this.created_at = data.created_at;
    this.empresa_id = data.empresa_id;
  }

  // Método para obtener un producto por ID con recetas y stock de sucursal
  static async getById(id, sucuId = null) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      const { data, error } = await supabase
        .from('products_almacen')
        .select(`
          *,
          category_almacen:category_id (
            id,
            name
          ),
          price_product (
            id,
            valor,
            prices_types:price_id (
              id,
              name,
              description
            )
          ),
          recetas (
            id,
            descripcion,
            recetas_detalle (
              id,
              cantidad,
              products_acopio:producto_acopio_id (
                id,
                name,
                quantity
              )
            )
          ),
          productos_sucursal (
            id,
            stock,
            sucursal_id
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

      // Si se especifica sucuId, agregar el stock de esa sucursal específica
      if (sucuId && data) {
        const stockSucursal = data.productos_sucursal?.find(ps => ps.sucursal_id === sucuId);
        data.stock = stockSucursal ? stockSucursal.stock : 0;
      }

      return data;
    } catch (error) {
      console.error('Error al obtener el producto:', error);
      throw error;
    }
  }

  // Método para obtener múltiples productos por IDs con recetas (bulk query)
  static async getByIds(ids, empresaId = null) {
    try {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('Array de IDs de productos es requerido');
      }

      let query = supabase
        .from('products_almacen')
        .select(`
          *,
          category_almacen:category_id (
            id,
            name
          ),
          price_product (
            id,
            valor,
            prices_types:price_id (
              id,
              name,
              description
            )
          ),
          recetas (
            id,
            descripcion,
            recetas_detalle (
              id,
              cantidad,
              products_acopio:producto_acopio_id (
                id,
                name,
                quantity
              )
            )
          )
        `)
        .in('id', ids);

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error('No se pudieron obtener los productos');
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener productos por IDs:', error);
      throw error;
    }
  }

  // Método para obtener todos los productos de una empresa con stock de sucursal
  static async getAll(empresaId, sucuId = null) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const { data, error } = await supabase
        .from('products_almacen')
        .select(`
          *,
          category_almacen:category_id (
            id,
            name
          ),
          price_product (
            id,
            valor,
            prices_types:price_id (
              id,
              name,
              description
            )
          ),
          recetas (
            id,
            descripcion,
            recetas_detalle (
              id,
              cantidad,
              products_acopio:producto_acopio_id (
                id,
                name,
                quantity
              )
            )
          ),
          productos_sucursal (
            id,
            stock,
            sucursal_id
          )
        `)
        .eq('empresa_id', empresaId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los productos');
      }

      // Si se especifica sucuId, agregar el stock de esa sucursal específica
      if (sucuId && data) {
        data.forEach(producto => {
          const stockSucursal = producto.productos_sucursal?.find(ps => ps.sucursal_id === sucuId);
          producto.stock = stockSucursal ? stockSucursal.stock : 0;
        });
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener los productos:', error);
      throw new Error('No se pudo obtener los productos');
    }
  }

  // Crear un producto con precios, receta y stock en sucursal
  static async create(productData, empresaId, sucuId = null) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // 1. Crear el producto principal (sin stock, ya que se maneja en productos_sucursal)
      const dbProductData = {
        name: productData.name,
        codigo_barras: productData.codigo_barras || null,
        category_id: productData.category_id || null,
        description: productData.description || null,
        empresa_id: empresaId
      };

      const { data: product, error: productError } = await supabase
        .from('products_almacen')
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

      // 2. Crear el stock en la sucursal si se proporciona sucuId
      if (sucuId && productData.stock !== undefined) {
        const { error: stockError } = await supabase
          .from('productos_sucursal')
          .insert([{
            producto_id: productId,
            sucursal_id: sucuId,
            stock: productData.stock || 0
          }]);

        if (stockError) {
          console.error('Error al crear stock en sucursal:', stockError);
          // No lanzar error aquí, solo log
        }
      }

      // 3. Crear los precios para todos los tipos de precios
      if (productData.prices && Object.keys(productData.prices).length > 0) {
        const priceInserts = Object.entries(productData.prices).map(([priceTypeId, valor]) => ({
          producto_almacen_id: productId,
          price_id: priceTypeId,
          valor: valor || 0 // Si no tiene valor, poner 0
        }));

        const { error: pricesError } = await supabase
          .from('price_product')
          .insert(priceInserts);

        if (pricesError) {
          console.error('Error al crear precios:', pricesError);
          // No lanzar error aquí, solo log
        }
      }

      // 3. Crear la receta si existe
      if (productData.receta && productData.receta.productos && productData.receta.productos.length > 0) {
        // Crear la receta principal
        const { data: receta, error: recetaError } = await supabase
          .from('recetas')
          .insert([{
            producto_almacen_id: productId,
            descripcion: productData.receta.descripcion || null
          }])
          .select();

        if (recetaError) {
          console.error('Error al crear receta:', recetaError);
          // No lanzar error aquí, solo log
        } else if (receta && receta.length > 0) {
          const recetaId = receta[0].id;

          // Crear los detalles de la receta
          const recetaDetalleInserts = productData.receta.productos.map(detalle => ({
            receta_id: recetaId,
            producto_acopio_id: detalle.producto_acopio_id,
            cantidad: detalle.cantidad
          }));

          const { error: recetaDetalleError } = await supabase
            .from('recetas_detalle')
            .insert(recetaDetalleInserts);

          if (recetaDetalleError) {
            console.error('Error al crear detalles de receta:', recetaDetalleError);
            // No lanzar error aquí, solo log
          }
        }
      }

      // Devolver el producto completo con todos los joins
      const { data: completeProduct, error: completeError } = await supabase
        .from('products_almacen')
        .select(`
          *,
          category_almacen:category_id (
            id,
            name
          ),
          price_product (
            id,
            valor,
            prices_types (
              id,
              name,
              description
            )
          ),
          recetas (
            id,
            descripcion,
            recetas_detalle (
              id,
              cantidad,
              products_acopio:producto_acopio_id (
                id,
                name,
                quantity
              )
            )
          ),
          productos_sucursal (
            id,
            stock,
            sucursal_id
          )
        `)
        .eq('id', product[0].id)
        .eq('empresa_id', empresaId)
        .single();

      if (completeError) {
        console.error('Error al obtener producto completo:', completeError);
        // Si hay error, devolver al menos el producto básico
        return product[0];
      }

      // Si se especifica sucuId, agregar el stock de esa sucursal específica
      if (sucuId && completeProduct) {
        const stockSucursal = completeProduct.productos_sucursal?.find(ps => ps.sucursal_id === sucuId);
        completeProduct.stock = stockSucursal ? stockSucursal.stock : 0;
      }

      return completeProduct;
    } catch (error) {
      console.error('Error al crear el producto:', error);
      throw error;
    }
  }

  // Actualizar un producto
  static async update(id, productData, sucuId = null) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      const updateData = {
        name: productData.name,
        codigo_barras: productData.codigo_barras || null,
        category_id: productData.category_id || null,
        description: productData.description || null
      };

      // Actualizar el producto principal
      const { data, error } = await supabase
        .from('products_almacen')
        .update(updateData)
        .eq('id', id)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo actualizar el producto');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar el producto');
      }

      const productId = data[0].id;

      // Actualizar stock en productos_sucursal si se proporciona sucuId
      if (sucuId && productData.stock !== undefined) {
        // Verificar si ya existe la relación
        const { data: existingStock } = await supabase
          .from('productos_sucursal')
          .select('id')
          .eq('producto_id', productId)
          .eq('sucursal_id', sucuId)
          .single();

        if (existingStock) {
          // Actualizar stock existente
          const { error: stockUpdateError } = await supabase
            .from('productos_sucursal')
            .update({ stock: productData.stock || 0 })
            .eq('producto_id', productId)
            .eq('sucursal_id', sucuId);

          if (stockUpdateError) {
            console.error('Error al actualizar stock en sucursal:', stockUpdateError);
          }
        } else {
          // Crear nueva relación con stock
          const { error: stockCreateError } = await supabase
            .from('productos_sucursal')
            .insert([{
              producto_id: productId,
              sucursal_id: sucuId,
              stock: productData.stock || 0
            }]);

          if (stockCreateError) {
            console.error('Error al crear stock en sucursal:', stockCreateError);
          }
        }
      }

      // Actualizar precios si se proporcionan
      if (productData.prices && Object.keys(productData.prices).length > 0) {
        // Eliminar precios existentes
        await supabase
          .from('price_product')
          .delete()
          .eq('producto_almacen_id', productId);

        // Insertar nuevos precios
        for (const [priceTypeId, valor] of Object.entries(productData.prices)) {
          if (valor && valor !== '') {
            await supabase
              .from('price_product')
              .insert({
                producto_almacen_id: productId,
                price_id: priceTypeId,
                valor: parseFloat(valor) || 0
              });
          }
        }
      }

      // Actualizar receta si se proporciona
      if (productData.receta) {
        // Eliminar receta existente y sus detalles
        const { data: existingRecetas } = await supabase
          .from('recetas')
          .select('id')
          .eq('producto_almacen_id', productId);

        if (existingRecetas && existingRecetas.length > 0) {
          const recetaId = existingRecetas[0].id;
          
          // Eliminar detalles de receta
          await supabase
            .from('recetas_detalle')
            .delete()
            .eq('receta_id', recetaId);

          // Eliminar receta
          await supabase
            .from('recetas')
            .delete()
            .eq('id', recetaId);
        }

        // Crear nueva receta si tiene datos
        if (productData.receta.descripcion || (productData.receta.productos && productData.receta.productos.length > 0)) {
          const { data: newReceta, error: recetaError } = await supabase
            .from('recetas')
            .insert({
              producto_almacen_id: productId,
              descripcion: productData.receta.descripcion || null
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
              receta_id: recetaId,
              producto_acopio_id: producto.producto_acopio_id,
              cantidad: parseFloat(producto.cantidad) || 0
            }));

            const { error: detallesError } = await supabase
              .from('recetas_detalle')
              .insert(detalles);

            if (detallesError) {
              console.error('Error creando detalles de receta:', detallesError);
              throw new Error('Error al actualizar los detalles de la receta');
            }
          }
        }
      }

      // Devolver el producto completo con precios y recetas
      const { data: productoCompleto, error: errorCompleto } = await supabase
        .from('products_almacen')
        .select(`
          *,
          category_almacen (
            id,
            name
          ),
          price_product (
            id,
            valor,
            prices_types (
              id,
              name,
              description
            )
          ),
          recetas (
            id,
            descripcion,
            recetas_detalle (
              id,
              cantidad,
              products_acopio (
                id,
                name,
                type_measure (
                  id,
                  name,
                  code
                )
              )
            )
          ),
          productos_sucursal (
            id,
            stock,
            sucursal_id
          )
        `)
        .eq('id', productId)
        .single();

      if (errorCompleto) {
        console.error('Error obteniendo producto completo:', errorCompleto);
        // Si hay error obteniendo el producto completo, devolver al menos el básico
        return data[0];
      }

      // Si se especifica sucuId, agregar el stock de esa sucursal específica
      if (sucuId && productoCompleto) {
        const stockSucursal = productoCompleto.productos_sucursal?.find(ps => ps.sucursal_id === sucuId);
        productoCompleto.stock = stockSucursal ? stockSucursal.stock : 0;
      }

      return productoCompleto;
    } catch (error) {
      console.error('Error al actualizar el producto:', error);
      throw error;
    }
  }

  // Eliminar un producto
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      // 1. Obtener las recetas del producto para eliminar sus detalles
      const { data: recetas, error: errorRecetasQuery } = await supabase
        .from('recetas')
        .select('id')
        .eq('producto_almacen_id', id);

      if (errorRecetasQuery) {
        console.error('Error obteniendo recetas:', errorRecetasQuery);
        throw new Error('No se pudieron obtener las recetas del producto');
      }

      // 2. Eliminar detalles de recetas si existen
      if (recetas && recetas.length > 0) {
        const recetaIds = recetas.map(r => r.id);
        const { error: errorDetalles } = await supabase
          .from('recetas_detalle')
          .delete()
          .in('receta_id', recetaIds);

        if (errorDetalles) {
          console.error('Error eliminando detalles de recetas:', errorDetalles);
          throw new Error('No se pudieron eliminar los detalles de las recetas');
        }
      }

      // 3. Eliminar las recetas
      const { error: errorRecetas } = await supabase
        .from('recetas')
        .delete()
        .eq('producto_almacen_id', id);

      if (errorRecetas) {
        console.error('Error eliminando recetas:', errorRecetas);
        throw new Error('No se pudieron eliminar las recetas');
      }

      // 4. Eliminar los precios del producto
      const { error: errorPrecios } = await supabase
        .from('price_product')
        .delete()
        .eq('producto_almacen_id', id);

      if (errorPrecios) {
        console.error('Error eliminando precios:', errorPrecios);
        throw new Error('No se pudieron eliminar los precios del producto');
      }

      // 5. Eliminar todas las relaciones de stock en productos_sucursal
      const { error: errorStock } = await supabase
        .from('productos_sucursal')
        .delete()
        .eq('producto_id', id);

      if (errorStock) {
        console.error('Error eliminando stock de sucursales:', errorStock);
        throw new Error('No se pudieron eliminar las relaciones de stock del producto');
      }

      // 6. Finalmente eliminar el producto principal
      const { error } = await supabase
        .from('products_almacen')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error eliminando producto principal:', error);
        
        // Verificar si es un error de foreign key constraint
        if (error.code === '23503') {
          if (error.message.includes('pedido_almacen_detalle')) {
            throw new Error('No se puede eliminar este producto porque está siendo utilizado en pedidos existentes. Primero elimine o modifique los pedidos que contienen este producto.');
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
}

module.exports = productsAlmacen;
