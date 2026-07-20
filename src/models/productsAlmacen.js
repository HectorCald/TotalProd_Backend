const { supabase } = require('../config/supabase');
const { calculateProductsSizes, logProductsSizes } = require('../utils/dataSizeHelper');

class productsAlmacen {

  // Constructor para crear un producto
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.stock = data.stock;
    this.codigo_barras = data.codigo_barras;
    this.category_id = data.category_id;
    this.created_at = data.created_at;
    this.empresa_id = data.empresa_id;
    this.grup = data.grup;
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
          producto_categoria (
            id,
            categoria_id,
            category_almacen:categoria_id (
              id,
              name
            )
          ),
          price_product (
            id,
            valor,
            prices_types:price_id (
              id,
              name
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

      // Agregar category_name (desde producto_categoria N:M o legacy category_id)
      if (data) {
        if (data.producto_categoria && data.producto_categoria.length > 0) {
          data.category_names = data.producto_categoria.map(pc => pc.category_almacen?.name).filter(Boolean);
          data.category_name = data.category_names.join(', ') || 'Sin categoría';
        } else {
          data.category_name = data.category_almacen?.name || 'Sin categoría';
          data.category_names = data.category_almacen?.name ? [data.category_almacen.name] : [];
        }
      }

      return data;
    } catch (error) {
      console.error('Error al obtener el producto:', error);
      throw error;
    }
  }

  // Método rápido para obtener productos básicos por IDs de golpe
  static async getByIdsFast(ids, empresaId = null, sucuId = null) {
    try {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('Array de IDs de productos es requerido');
      }

      let query = supabase
        .from('products_almacen')
        .select(`
          id,
          name,
          grup,
          price_product (
            id,
            valor,
            price_id,
            prices_types:price_id (
              id,
              name
            )
          ),
          productos_sucursal (
            id,
            stock,
            sucursal_id
          )
        `)
        .in('id', ids);

      // No filtramos estrictamente por empresaId aquí para permitir productos de empresas asociadas,
      // los UUIDs ya garantizan que solo se acceda a los productos solicitados.

      const { data, error } = await query;

      if (error) {
        throw new Error('No se pudieron obtener los productos');
      }

      if (data) {
        data.forEach(producto => {
          if (sucuId) {
            const stockSucursal = producto.productos_sucursal?.find(ps => ps.sucursal_id === sucuId);
            producto.stock = stockSucursal ? stockSucursal.stock : 0;
          } else {
            producto.stock = 0;
          }
        });
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener productos rápidos por IDs:', error);
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
          producto_categoria (
            id,
            categoria_id,
            category_almacen:categoria_id (
              id,
              name
            )
          ),
          price_product (
            id,
            valor,
            prices_types:price_id (
              id,
              name
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
        .in('id', ids);

      // No filtramos estrictamente por empresaId aquí para permitir productos de empresas asociadas,
      // los UUIDs ya garantizan que solo se acceda a los productos solicitados.

      const { data, error } = await query;

      if (error) {
        throw new Error('No se pudieron obtener los productos');
      }

      // Agregar category_name a cada producto (N:M o legacy)
      if (data) {
        data.forEach(producto => {
          if (producto.producto_categoria && producto.producto_categoria.length > 0) {
            producto.category_names = producto.producto_categoria.map(pc => pc.category_almacen?.name).filter(Boolean);
            producto.category_name = producto.category_names.join(', ') || 'Sin categoría';
          } else {
            producto.category_name = producto.category_almacen?.name || 'Sin categoría';
            producto.category_names = producto.category_almacen?.name ? [producto.category_almacen.name] : [];
          }
        });
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener productos por IDs:', error);
      throw error;
    }
  }

  // Método para obtener todos los productos de una empresa con stock de sucursal
  static async getAll(empresaId, sucuId = null, empresasAsociadasIds = [], ocultarStockCero = false, page = 1, limit = 30, search = null, categoryId = null, sortOrder = 'name_asc') {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // Construir array de IDs de empresas (empresa actual + asociadas)
      const empresaIds = [empresaId];
      if (Array.isArray(empresasAsociadasIds) && empresasAsociadasIds.length > 0) {
        empresaIds.push(...empresasAsociadasIds);
      }

      const offset = (page - 1) * limit;

      let query = supabase
        .from('products_almacen')
        .select(`
          id,
          name,
          description,
          codigo_barras,
          category_id,
          created_at,
          empresa_id,
          grup,
          stock_minimo,
          costo_produccion,
          category_almacen:category_id (
            id,
            name
          ),
          producto_categoria (
            id,
            categoria_id,
            category_almacen:categoria_id (
              id,
              name
            )
          ),
          price_product (
            id,
            valor,
            prices_types:price_id (
              id,
              name
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
          ),
          productos_sucursal (
            id,
            stock,
            sucursal_id
          )
        `, { count: 'estimated' })
        .in('empresa_id', empresaIds);

      // Search filter
      if (search && search.trim() !== '') {
        query = query.ilike('name', `%${search.trim()}%`);
      }

      // Category filter - buscar en tabla intermedia producto_categoria
      if (categoryId) {
        let filterCatIds = [];
        if (Array.isArray(categoryId)) {
          filterCatIds = categoryId.filter(id => id && String(id).trim() !== '');
        } else if (typeof categoryId === 'string' && categoryId.trim() !== '') {
          if (categoryId.includes(',')) {
            filterCatIds = categoryId.split(',').map(id => id.trim()).filter(id => id);
          } else {
            filterCatIds = [categoryId.trim()];
          }
        }
        if (filterCatIds.length > 0) {
          // Obtener IDs de productos que tienen esas categorías en la tabla intermedia
          const { data: pcRows } = await supabase
            .from('producto_categoria')
            .select('producto_id')
            .in('categoria_id', filterCatIds);
          const productIdsFromCat = pcRows ? [...new Set(pcRows.map(r => r.producto_id))] : [];
          
          if (productIdsFromCat.length > 0) {
            query = query.in('id', productIdsFromCat);
          } else {
            // No hay productos con esas categorías en la tabla intermedia, forzar resultado vacío
            query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
          }
        }
      }

      const isMemoryRequired = ocultarStockCero || sortOrder === 'stock_desc' || sortOrder === 'stock_asc';

      // Sorting
      if (sortOrder === 'name_desc') {
        query = query.order('name', { ascending: false });
      } else if (!isMemoryRequired) {
        query = query.order('name', { ascending: true }); // Default
      }

      // Pagination
      if (!isMemoryRequired) {
        query = query.range(offset, offset + limit - 1);
      } else {
        query = query.limit(5000); // Traer todo lo necesario para ordenar/filtrar en memoria
      }

      const { data, error, count } = await query;

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

      // Agregar category_name (N:M) y es_asociado a cada producto
      if (data) {
        // [MIGRACION INICIO] Migrar categorías legacy a tabla intermedia (eliminar esto en el futuro)
        const productsToMigrate = data.filter(p => p.category_id && (!p.producto_categoria || p.producto_categoria.length === 0));
        
        if (productsToMigrate.length > 0) {
          const insertData = productsToMigrate.map(p => ({
            producto_id: p.id,
            categoria_id: p.category_id
          }));
          
          const { error: insertError } = await supabase
            .from('producto_categoria')
            .insert(insertData);
            
          if (insertError) {
            console.error('Error migrando categorías a producto_categoria:', insertError);
          } else {
            // Simular el join para la respuesta actual
            productsToMigrate.forEach(p => {
              if (!p.producto_categoria) p.producto_categoria = [];
              p.producto_categoria.push({
                category_almacen: p.category_almacen
              });
            });
          }
        }
        // [MIGRACION FIN]

        data.forEach(producto => {
          if (producto.producto_categoria && producto.producto_categoria.length > 0) {
            producto.category_names = producto.producto_categoria.map(pc => pc.category_almacen?.name).filter(Boolean);
            producto.category_name = producto.category_names.join(', ');
          } else {
            producto.category_name = '';
            producto.category_names = [];
          }
          producto.es_asociado = producto.empresa_id !== empresaId;
        });
      }
      
      let allData = data || [];
      
      // Si ocultarStockCero es true y hay sucuId, filtrar productos con stock <= 0
      if (sucuId && ocultarStockCero) {
        allData = allData.filter(producto => (Number(producto.stock) || 0) > 0);
      }

      // Ordenar en memoria si es requerido
      if (sortOrder === 'stock_desc') {
        allData.sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0));
      } else if (sortOrder === 'stock_asc') {
        allData.sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0));
      }

      let productosFinales = allData;
      let finalCount = count;

      if (isMemoryRequired) {
        finalCount = allData.length;
        productosFinales = allData.slice(offset, offset + limit);
      }

      let sizeInfo = null;
      // Calcular y loggear tamaños de datos
      if (productosFinales && productosFinales.length > 0) {
        const sizes = calculateProductsSizes(productosFinales);
        logProductsSizes(sizes, 'getAll');
        sizeInfo = sizes;
      }

      return {
        data: productosFinales,
        pagination: {
          hasNextPage: (offset + limit) < finalCount
        },
        sizeInfo
      };
    } catch (error) {
      console.error('Error al obtener los productos:', error);
      throw new Error('No se pudo obtener los productos');
    }
  }

  // Método ligero para obtener solo id y name de productos (para formularios de producción)
  static async getAllForProduction(empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const { data, error } = await supabase
        .from('products_almacen')
        .select('id, name')
        .eq('empresa_id', empresaId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los productos');
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener los productos para producción:', error);
      throw new Error('No se pudo obtener los productos');
    }
  }

  // Método para obtener productos específicos para conteo
  static async getProductsForConteo(empresaId, sucuId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const { data, error } = await supabase
        .from('products_almacen')
        .select(`
          id,
          name,
          category_id,
          grup,
          productos_sucursal (
            stock,
            sucursal_id
          ),
          producto_categoria (
            categoria_id
          )
        `)
        .eq('empresa_id', empresaId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los productos para conteo');
      }

      if (data) {
        data.forEach(producto => {
          if (sucuId) {
            const stockSucursal = producto.productos_sucursal?.find(ps => ps.sucursal_id === sucuId);
            producto.stock = stockSucursal ? stockSucursal.stock : 0;
          } else {
            producto.stock = 0;
          }
          
          // Flatten categories for easy frontend filtering
          let cats = [];
          if (producto.category_id) cats.push(producto.category_id);
          if (producto.producto_categoria && producto.producto_categoria.length > 0) {
            cats.push(...producto.producto_categoria.map(pc => pc.categoria_id));
          }
          producto.category_ids = [...new Set(cats)];
          
          delete producto.productos_sucursal;
          delete producto.producto_categoria;
        });
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener los productos para conteo:', error);
      throw new Error('No se pudo obtener los productos');
    }
  }

  // Crear un producto con precios, receta y stock en sucursal
  static async create(productData, empresaId, sucuId = null) {
    const tCreateStart = Date.now();
    console.log('🚀 [CREATE PRODUCT] Iniciando creación de producto');
    
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
        .from('products_almacen')
        .select('id')
        .eq('empresa_id', empresaId)
        .ilike('name', nombreProducto)
        .limit(1);

      if (errorExistentes) {
        console.error('Error verificando duplicados de producto (almacen):', errorExistentes);
        throw new Error('No se pudo verificar si el producto ya existe');
      }

      if (existentes && existentes.length > 0) {
        throw new Error('Ya existe un producto con el mismo nombre en esta empresa');
      }

      // 1. Crear el producto principal (sin stock, ya que se maneja en productos_sucursal)
      const tProductStart = Date.now();
      // Numéricos opcionales: vacío/null → null en DB (no 0)
      const optionalNum = (v) => (v != null && v !== '') ? Number(v) : null;

      const dbProductData = {
        name: nombreProducto,
        description: productData.description || null,
        codigo_barras: productData.codigo_barras || null,
        category_id: productData.category_id || null,
        empresa_id: empresaId,
        grup: optionalNum(productData.grup),
        stock_minimo: optionalNum(productData.stock_minimo),
        costo_produccion: optionalNum(productData.costo_produccion)
      };

      const { data: product, error: productError } = await supabase
        .from('products_almacen')
        .insert([dbProductData])
        .select();
      const tProductMs = Date.now() - tProductStart;
      console.log(`⏱️ [CREATE PRODUCT] Crear producto principal: ${tProductMs}ms`);

      if (productError) {
        console.error('Error de Supabase al crear producto:', productError);
        throw new Error('No se pudo crear el producto');
      }

      if (!product || product.length === 0) {
        throw new Error('No se pudo crear el producto');
      }

      const productId = product[0].id;

      // 2. Crear stock, precios y categorías N:M en paralelo (OPTIMIZADO)
      const tParallelStart = Date.now();
      const parallelOperations = [];

      // Preparar operación de stock
      if (sucuId && productData.stock !== undefined) {
        parallelOperations.push(
          supabase
            .from('productos_sucursal')
            .insert([{
              producto_id: productId,
              sucursal_id: sucuId,
              stock: productData.stock || 0
            }])
        );
      }

      // Preparar operación de precios
      if (productData.prices && Object.keys(productData.prices).length > 0) {
        const priceInserts = Object.entries(productData.prices).map(([priceTypeId, valor]) => ({
          producto_almacen_id: productId,
          price_id: priceTypeId,
          valor: valor || 0
        }));

        parallelOperations.push(
          supabase
            .from('price_product')
            .insert(priceInserts)
        );
      }

      // Preparar operación de categorías N:M
      const categoryIds = productData.category_ids || (productData.category_id ? [productData.category_id] : []);
      if (categoryIds.length > 0) {
        const catInserts = categoryIds.filter(id => id).map(catId => ({
          producto_id: productId,
          categoria_id: catId
        }));
        if (catInserts.length > 0) {
          parallelOperations.push(
            supabase
              .from('producto_categoria')
              .insert(catInserts)
          );
        }
      }

      // Ejecutar operaciones en paralelo
      if (parallelOperations.length > 0) {
        const results = await Promise.allSettled(parallelOperations);
        const tParallelMs = Date.now() - tParallelStart;
        console.log(`⏱️ [CREATE PRODUCT] Crear stock, precios y categorías en paralelo: ${tParallelMs}ms`);

        // Verificar errores
        results.forEach((result, index) => {
          if (result.status === 'rejected' || result.value.error) {
            console.error(`Error en operación paralela ${index}:`, result.value?.error || result.reason);
          }
        });
      }

      // 4. Crear la receta si existe
      if (productData.receta && productData.receta.productos && productData.receta.productos.length > 0) {
        const tRecetaStart = Date.now();
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
        const tRecetaMs = Date.now() - tRecetaStart;
        console.log(`⏱️ [CREATE PRODUCT] Crear receta y detalles: ${tRecetaMs}ms`);
      }

      // Devolver producto básico sin JOINs pesados (OPTIMIZADO)
      const tCompleteStart = Date.now();
      
      // Obtener información de las categorías N:M
      let categoryNames = [];
      let productoCategoriaData = [];
      const resolvedCategoryIds = productData.category_ids || (productData.category_id ? [productData.category_id] : []);
      if (resolvedCategoryIds.length > 0) {
        const { data: cats } = await supabase
          .from('category_almacen')
          .select('id, name')
          .in('id', resolvedCategoryIds);
        if (cats) {
          categoryNames = cats.map(c => c.name);
          productoCategoriaData = cats.map(c => ({
            categoria_id: c.id,
            category_almacen: { id: c.id, name: c.name }
          }));
        }
      }
      
      // Construir respuesta básica sin consultas adicionales
      const basicProduct = {
        ...product[0],
        stock: productData.stock || 0,
        category_name: categoryNames.join(', ') || 'Sin categoría',
        category_names: categoryNames,
        category_almacen: null,
        producto_categoria: productoCategoriaData,
        price_product: productData.prices ? await Promise.all(
          Object.entries(productData.prices).map(async ([price_id, valor]) => {
            const { data: priceType } = await supabase
              .from('prices_types')
              .select('id, name')
              .eq('id', price_id)
              .single();

            return {
              producto_almacen_id: productId,
              price_id: price_id,
              valor: parseFloat(valor) || 0,
              prices_types: priceType || { id: price_id, name: 'Precio' }
            };
          })
        ) : [],
        recetas: productData.receta ? [{
          id: 'temp_id',
          descripcion: productData.receta.descripcion || '',
          recetas_detalle: productData.receta.productos ? productData.receta.productos.map(prod => ({
            id: 'temp_id',
            cantidad: parseFloat(prod.cantidad) || 0,
            products_acopio: { id: prod.producto_acopio_id, name: 'Producto', quantity: 0 }
          })) : []
        }] : [],
        productos_sucursal: sucuId ? [{
          producto_id: productId,
          sucursal_id: sucuId,
          stock: productData.stock || 0
        }] : []
      };
      
      const tCompleteMs = Date.now() - tCompleteStart;
      console.log(`⏱️ [CREATE PRODUCT] Construir respuesta básica: ${tCompleteMs}ms`);

      const tCreateMs = Date.now() - tCreateStart;
      console.log(`⏱️ [CREATE PRODUCT] Total creación: ${tCreateMs}ms`);

      return basicProduct;
    } catch (error) {
      console.error('Error al crear el producto:', error);
      throw error;
    }
  }

  // Actualizar un producto
  static async update(id, productData, sucuId = null) {
    const tUpdateStart = Date.now();
    console.log('🚀 [UPDATE PRODUCT] Iniciando actualización de producto');
    
    try {
      if (!id) {
        throw new Error('ID del producto es requerido');
      }

      // Numéricos opcionales: vacío/null → null en DB (consistencia con create)
      const optionalNum = (v) => (v != null && v !== '') ? Number(v) : null;

      const updateData = {
        name: productData.name,
        description: productData.description || null,
        codigo_barras: productData.codigo_barras || null,
        category_id: productData.category_id || null,
        grup: optionalNum(productData.grup),
        stock_minimo: optionalNum(productData.stock_minimo),
        costo_produccion: optionalNum(productData.costo_produccion)
      };

      // Actualizar el producto principal
      const tProductStart = Date.now();
      const { data, error } = await supabase
        .from('products_almacen')
        .update(updateData)
        .eq('id', id)
        .select();
      const tProductMs = Date.now() - tProductStart;
      console.log(`⏱️ [UPDATE PRODUCT] Actualizar producto principal: ${tProductMs}ms`);

      if (error) {
        throw new Error('No se pudo actualizar el producto');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo actualizar el producto');
      }

      const productId = data[0].id;

      // Migrar category_id legacy a producto_categoria si existe
      if (data[0].category_id && productData.category_ids) {
        // Verificar si ya existe en la tabla intermedia
        const { data: existingPc } = await supabase
          .from('producto_categoria')
          .select('id')
          .eq('producto_id', productId)
          .eq('categoria_id', data[0].category_id);
        
        if (!existingPc || existingPc.length === 0) {
          // Migrar: agregar la categoría legacy a la tabla intermedia si no está ya en category_ids
          if (!productData.category_ids.includes(data[0].category_id)) {
            // Solo migrar si no está incluida en las nuevas categorías
            // (si ya está, se insertará con las demás)
          }
        }
        
        // Limpiar category_id legacy del producto
        await supabase
          .from('products_almacen')
          .update({ category_id: null })
          .eq('id', productId);
      }

      // Actualizar stock, precios y categorías en paralelo (OPTIMIZADO)
      const tParallelStart = Date.now();
      const parallelOperations = [];

      // Preparar operación de stock
      if (sucuId && productData.stock !== undefined) {
        parallelOperations.push(
          supabase
            .from('productos_sucursal')
            .upsert({
              producto_id: productId,
              sucursal_id: sucuId,
              stock: productData.stock || 0
            }, {
              onConflict: 'producto_id,sucursal_id'
            })
        );
      }

      // Preparar operación de precios
      if (productData.prices && Object.keys(productData.prices).length > 0) {
        const preciosArray = [];
        for (const [priceTypeId, valor] of Object.entries(productData.prices)) {
          if (valor && valor !== '') {
            preciosArray.push({
              producto_almacen_id: productId,
              price_id: priceTypeId,
              valor: parseFloat(valor) || 0
            });
          }
        }

        if (preciosArray.length > 0) {
          parallelOperations.push(
            (async () => {
              await supabase
                .from('price_product')
                .delete()
                .eq('producto_almacen_id', productId);
              return await supabase
                .from('price_product')
                .insert(preciosArray);
            })()
          );
        }
      }

      // Preparar operación de categorías N:M (delete + insert)
      if (productData.category_ids) {
        parallelOperations.push(
          (async () => {
            // Eliminar relaciones existentes
            await supabase
              .from('producto_categoria')
              .delete()
              .eq('producto_id', productId);
            
            // Insertar nuevas relaciones
            const catIds = productData.category_ids.filter(id => id);
            if (catIds.length > 0) {
              const catInserts = catIds.map(catId => ({
                producto_id: productId,
                categoria_id: catId
              }));
              return await supabase
                .from('producto_categoria')
                .insert(catInserts);
            }
          })()
        );
      }

      // Ejecutar operaciones en paralelo
      if (parallelOperations.length > 0) {
        const results = await Promise.allSettled(parallelOperations);
        const tParallelMs = Date.now() - tParallelStart;
        console.log(`⏱️ [UPDATE PRODUCT] Actualizar stock, precios y categorías en paralelo: ${tParallelMs}ms`);

        // Verificar errores
        results.forEach((result, index) => {
          if (result.status === 'rejected' || result.value?.error) {
            console.error(`Error en operación paralela ${index}:`, result.value?.error || result.reason);
            throw new Error('Error al actualizar stock, precios o categorías');
          }
        });
      }

      // Actualizar receta si se proporciona (OPTIMIZADO)
      if (productData.receta) {
        const tRecetaStart = Date.now();
        // Primero obtener los IDs de recetas existentes
        const { data: existingRecetas } = await supabase
          .from('recetas')
          .select('id')
          .eq('producto_almacen_id', productId);

        // Eliminar detalles de recetas existentes si hay recetas
        if (existingRecetas && existingRecetas.length > 0) {
          const recetaIds = existingRecetas.map(r => r.id);
          await supabase
            .from('recetas_detalle')
            .delete()
            .in('receta_id', recetaIds);
        }

        // Eliminar la receta
        await supabase
          .from('recetas')
          .delete()
          .eq('producto_almacen_id', productId);

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
              throw new Error('Error al actualizar los detalles de la receta');
            }
          }
        }
        const tRecetaMs = Date.now() - tRecetaStart;
        console.log(`⏱️ [UPDATE PRODUCT] Actualizar receta: ${tRecetaMs}ms`);
      }

      // Obtener categorías N:M actualizadas
      const resolvedCategoryIds = productData.category_ids || [];
      let categoryNames = [];
      let productoCategoriaData = [];
      if (resolvedCategoryIds.length > 0) {
        const { data: cats } = await supabase
          .from('category_almacen')
          .select('id, name')
          .in('id', resolvedCategoryIds);
        if (cats) {
          categoryNames = cats.map(c => c.name);
          productoCategoriaData = cats.map(c => ({
            categoria_id: c.id,
            category_almacen: { id: c.id, name: c.name }
          }));
        }
      }

      const productoActualizado = {
        ...data[0],
        category_id: null, // Ya no se usa, migrado a N:M
        stock: productData.stock || 0,
        category_name: categoryNames.join(', ') || 'Sin categoría',
        category_names: categoryNames,
        category_almacen: null,
        producto_categoria: productoCategoriaData,
        price_product: productData.prices ? await Promise.all(
          Object.entries(productData.prices).map(async ([price_id, valor]) => {
            const { data: priceType } = await supabase
              .from('prices_types')
              .select('id, name')
              .eq('id', price_id)
              .single();

            return {
              producto_almacen_id: productId,
              price_id: price_id,
              valor: parseFloat(valor) || 0,
              prices_types: priceType || { id: price_id, name: 'Precio no encontrado' }
            };
          })
        ) : [],
        recetas: productData.receta ? [{
          id: 'temp_id',
          producto_almacen_id: productId,
          descripcion: productData.receta.descripcion || '',
          recetas_detalle: productData.receta.productos ? await Promise.all(
            productData.receta.productos.map(async (prod) => {
              const { data: productoAcopio } = await supabase
                .from('products_acopio')
                .select('id, name, type_measure(id, name, code, code_menor, value)')
                .eq('id', prod.producto_acopio_id)
                .single();

              return {
                receta_id: 'temp_id',
                producto_acopio_id: prod.producto_acopio_id,
                cantidad: parseFloat(prod.cantidad) || 0,
                products_acopio: productoAcopio || { 
                  id: prod.producto_acopio_id, 
                  name: 'Producto no encontrado',
                  type_measure: { id: null, name: '', code: '' }
                }
              };
            })
          ) : []
        }] : [],
        productos_sucursal: sucuId ? [{
          producto_id: productId,
          sucursal_id: sucuId,
          stock: productData.stock || 0
        }] : []
      };

      const tUpdateMs = Date.now() - tUpdateStart;
      console.log(`⏱️ [UPDATE PRODUCT] Total actualización: ${tUpdateMs}ms`);

      return productoActualizado;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar múltiples productos en lote (para importación)
  static async bulkUpdate(productosData, empresaId, sucuId = null) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      if (!Array.isArray(productosData) || productosData.length === 0) {
        throw new Error('Array de productos es requerido');
      }

      const resultados = {
        actualizados: 0,
        errores: [],
        total: productosData.length
      };

      // Procesar cada producto en paralelo (con límite de concurrencia)
      const BATCH_SIZE = 10; // Procesar de 10 en 10 para evitar sobrecarga
      const batches = [];
      
      for (let i = 0; i < productosData.length; i += BATCH_SIZE) {
        batches.push(productosData.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (productoData) => {
          try {
            const { id, name, codigo_barras, precios, stock } = productoData;
            
            if (!id) {
              throw new Error('ID del producto es requerido');
            }

            // Preparar datos de actualización
            const updateData = {};
            if (name !== undefined && name !== null && name !== '') updateData.name = name;
            if (codigo_barras !== undefined && codigo_barras !== null) updateData.codigo_barras = codigo_barras;

            // Actualizar producto principal si hay cambios
            if (Object.keys(updateData).length > 0) {
              const { error: productError } = await supabase
                .from('products_almacen')
                .update(updateData)
                .eq('id', id)
                .eq('empresa_id', empresaId);

              if (productError) {
                throw new Error(`Error actualizando producto ${id}: ${productError.message}`);
              }
            }

            // Actualizar stock en sucursal si se proporciona
            if (sucuId && stock !== undefined && stock !== null) {
              const stockVal = parseInt(stock, 10);
              if (!isNaN(stockVal) && stockVal >= 0) {
                const { error: stockError } = await supabase
                  .from('productos_sucursal')
                  .upsert({
                    producto_id: id,
                    sucursal_id: sucuId,
                    stock: stockVal
                  }, {
                    onConflict: 'producto_id,sucursal_id'
                  });

                if (stockError) {
                  throw new Error(`Error actualizando stock del producto ${id}: ${stockError.message}`);
                }
              }
            }

            // Actualizar precios si se proporcionan
            if (precios && Object.keys(precios).length > 0) {
              // Eliminar precios existentes
              await supabase
                .from('price_product')
                .delete()
                .eq('producto_almacen_id', id);

              // Insertar nuevos precios
              const preciosArray = Object.entries(precios)
                .filter(([_, valor]) => valor !== null && valor !== undefined && valor !== '')
                .map(([priceTypeId, valor]) => ({
                  producto_almacen_id: id,
                  price_id: priceTypeId,
                  valor: parseFloat(valor) || 0
                }));

              if (preciosArray.length > 0) {
                const { error: preciosError } = await supabase
                  .from('price_product')
                  .insert(preciosArray);

                if (preciosError) {
                  throw new Error(`Error actualizando precios del producto ${id}: ${preciosError.message}`);
                }
              }
            }

            resultados.actualizados++;
            return { success: true, id, name: productoData.name };
          } catch (error) {
            const errorMsg = `Producto ${productoData.id || 'desconocido'}: ${error.message}`;
            resultados.errores.push(errorMsg);
            console.error('Error en producto individual:', errorMsg);
            return { success: false, id: productoData.id, error: errorMsg };
          }
        });

        // Esperar a que termine el batch actual
        await Promise.allSettled(batchPromises);
      }


      return {
        success: true,
        data: resultados,
        message: `Actualización completada: ${resultados.actualizados}/${resultados.total} productos actualizados`
      };
    } catch (error) {
      console.error('Error en bulkUpdate:', error);
      throw error;
    }
  }

  // Crear múltiples productos en lote (para plantillas)
  static async bulkCreate(productosData, empresaId, sucuId = null) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      if (!Array.isArray(productosData) || productosData.length === 0) {
        throw new Error('Array de productos es requerido');
      }

      const resultados = {
        creados: 0,
        errores: [],
        total: productosData.length
      };

      // Procesar cada producto en paralelo (con límite de concurrencia)
      const BATCH_SIZE = 10; // Procesar de 10 en 10 para evitar sobrecarga
      const batches = [];
      
      for (let i = 0; i < productosData.length; i += BATCH_SIZE) {
        batches.push(productosData.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (productoData) => {
          try {
            const { name, codigo_barras, precios, stock } = productoData;
            
            if (!name || !name.trim()) {
              throw new Error('El nombre del producto es requerido');
            }

            // Verificar si ya existe un producto con el mismo nombre en la empresa
            const { data: existentes, error: errorExistentes } = await supabase
              .from('products_almacen')
              .select('id')
              .eq('empresa_id', empresaId)
              .ilike('name', name.trim())
              .limit(1);

            if (errorExistentes) {
              throw new Error(`Error verificando duplicados: ${errorExistentes.message}`);
            }

            if (existentes && existentes.length > 0) {
              throw new Error(`Ya existe un producto con el nombre "${name}" en esta empresa`);
            }

            // Crear el producto principal
            const { data: product, error: productError } = await supabase
              .from('products_almacen')
              .insert([{
                name: name.trim(),
                codigo_barras: codigo_barras || null,
                empresa_id: empresaId
              }])
              .select();

            if (productError) {
              throw new Error(`Error creando producto: ${productError.message}`);
            }

            if (!product || product.length === 0) {
              throw new Error('No se pudo crear el producto');
            }

            const productId = product[0].id;

            // Crear stock en sucursal si se especifica sucuId
            if (sucuId) {
              const stockInicial = (stock !== undefined && stock !== null && !isNaN(parseInt(stock, 10)))
                ? Math.max(0, parseInt(stock, 10))
                : 0;
              const { error: stockError } = await supabase
                .from('productos_sucursal')
                .insert([{
                  producto_id: productId,
                  sucursal_id: sucuId,
                  stock: stockInicial
                }]);

              if (stockError) {
                console.error('Error creando stock:', stockError);
                // No lanzar error aquí, solo log
              }
            }

            // Crear precios si se proporcionan
            if (precios && Object.keys(precios).length > 0) {
              const preciosArray = Object.entries(precios)
                .filter(([_, valor]) => valor !== null && valor !== undefined && valor !== '')
                .map(([priceTypeId, valor]) => ({
                  producto_almacen_id: productId,
                  price_id: priceTypeId,
                  valor: parseFloat(valor) || 0
                }));

              if (preciosArray.length > 0) {
                const { error: preciosError } = await supabase
                  .from('price_product')
                  .insert(preciosArray);

                if (preciosError) {
                  console.error('Error creando precios:', preciosError);
                  // No lanzar error aquí, solo log
                }
              }
            }

            resultados.creados++;
            return { success: true, id: productId, name: productoData.name };
          } catch (error) {
            const errorMsg = `Producto "${productoData.name || 'desconocido'}": ${error.message}`;
            resultados.errores.push(errorMsg);
            console.error('Error en producto individual:', errorMsg);
            return { success: false, name: productoData.name, error: errorMsg };
          }
        });

        // Esperar a que termine el batch actual
        await Promise.allSettled(batchPromises);
      }

      return {
        success: true,
        data: resultados,
        message: `Creación completada: ${resultados.creados}/${resultados.total} productos creados`
      };
    } catch (error) {
      console.error('Error en bulkCreate:', error);
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

      // 2. Eliminar detalles de recetas primero (dependencia de recetas)
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

      // 3. Eliminar recetas
      const { error: errorRecetas } = await supabase
        .from('recetas')
        .delete()
        .eq('producto_almacen_id', id);

      if (errorRecetas) {
        console.error('Error eliminando recetas:', errorRecetas);
        throw new Error('No se pudieron eliminar las recetas');
      }

      // 4-5. Eliminar precios y stock en paralelo (sin dependencias entre sí)
      const [preciosResult, stockResult] = await Promise.allSettled([
        supabase
          .from('price_product')
          .delete()
          .eq('producto_almacen_id', id),
        supabase
          .from('productos_sucursal')
          .delete()
          .eq('producto_id', id)
      ]);

      // Verificar errores
      if (preciosResult.status === 'rejected' || preciosResult.value?.error) {
        console.error('Error eliminando precios:', preciosResult.value?.error || preciosResult.reason);
        throw new Error('No se pudieron eliminar los precios del producto');
      }

      if (stockResult.status === 'rejected' || stockResult.value?.error) {
        console.error('Error eliminando stock:', stockResult.value?.error || stockResult.reason);
        throw new Error('No se pudieron eliminar las relaciones de stock del producto');
      }

      // 6. Finalmente eliminar el producto principal
      const { error } = await supabase
        .from('products_almacen')
        .delete()
        .eq('id', id);

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
