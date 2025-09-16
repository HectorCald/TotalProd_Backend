const { supabase } = require('../config/supabase');

class movimientosAcopio {
  // Crear un movimiento
  static async create(movimientoData, userId) {
    try {
      if (!movimientoData.product_id) {
        throw new Error('ID del producto es requerido');
      }

      if (!movimientoData.type) {
        throw new Error('Tipo de movimiento es requerido');
      }

      if (!movimientoData.quantity) {
        throw new Error('La cantidad es requerida');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }


      if (!movimientoData.sucu_id) {
        throw new Error('ID de la sucursal es requerido');
      }

      const dbData = {
        product_id: movimientoData.product_id,
        user_id: userId,
        sucu_id: movimientoData.sucu_id,
        type: movimientoData.type,
        observations: movimientoData.observations || null,
        proveedor_id: movimientoData.proveedor_id || null,
        cliente_id: movimientoData.cliente_id || null,
        quantity: movimientoData.quantity,
        date: new Date().toISOString() // Usar timestamp completo con hora
      };


      // Primero obtener el producto actual para actualizar su cantidad
      const { data: productoActual, error: errorProducto } = await supabase
        .from('products_acopio')
        .select('quantity')
        .eq('id', movimientoData.product_id)
        .single();

      if (errorProducto) {
        console.error('Error al obtener el producto:', errorProducto);
        throw new Error('No se pudo obtener el producto');
      }

      if (!productoActual) {
        throw new Error('Producto no encontrado');
      }

      // Calcular nueva cantidad según el tipo de movimiento
      const cantidadMovimiento = parseFloat(movimientoData.quantity);
      const cantidadActual = parseFloat(productoActual.quantity);
      let nuevaCantidad;

      if (movimientoData.type === 'entrada') {
        nuevaCantidad = cantidadActual + cantidadMovimiento;
      } else if (movimientoData.type === 'salida') {
        nuevaCantidad = cantidadActual - cantidadMovimiento;
        if (nuevaCantidad < 0) {
          throw new Error('No hay suficiente cantidad en stock para esta salida');
        }
      } else if (movimientoData.type === 'consumo_receta') {
        // Para consumo de receta, no actualizar el stock (ya se actualizó manualmente)
        nuevaCantidad = cantidadActual; // Mantener el stock actual
      } else {
        throw new Error('Tipo de movimiento inválido');
      }

      // Actualizar la cantidad del producto
      const { error: errorUpdate } = await supabase
        .from('products_acopio')
        .update({ quantity: nuevaCantidad })
        .eq('id', movimientoData.product_id);

      if (errorUpdate) {
        console.error('Error al actualizar la cantidad del producto:', errorUpdate);
        throw new Error('No se pudo actualizar la cantidad del producto');
      }

      // Crear el movimiento
      const { data: movimiento, error } = await supabase
        .from('movimientos_acopio')
        .insert([dbData])
        .select(`
          *,
          product:product_id (
            id,
            name,
            description,
            quantity,
            type_measure:type_measure_id (
              id,
              name,
              code
            )
          ),
          proveedor:proveedor_id (
            id,
            name
          )
        `)
        .single();

      if (error) {
        console.error('Error de Supabase al crear movimiento:', error);
        throw new Error('No se pudo crear el movimiento');
      }

      if (!movimiento) {
        throw new Error('No se pudo crear el movimiento');
      }

      return movimiento;
    } catch (error) {
      console.error('Error al crear el movimiento:', error);
      throw error;
    }
  }

  // Obtener movimientos por producto
  static async getByProduct(productId, sucuId) {
    try {
      if (!productId) {
        throw new Error('ID del producto es requerido');
      }

      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const { data, error } = await supabase
        .from('movimientos_acopio')
        .select(`
          *,
          product:product_id (
            id,
            name,
            description,
            quantity,
            type_measure:type_measure_id (
              id,
              name,
              code
            )
          ),
          proveedor:proveedor_id (
            id,
            name
          ),
          cliente:cliente_id (
            id,
            name
          )
        `)
        .eq('product_id', productId)
        .eq('sucu_id', sucuId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los movimientos');
      }

      return data || [];
    } catch (error) {
      console.error('Error al obtener movimientos por producto:', error);
      throw error;
    }
  }

  // Obtener todos los movimientos
  static async getAll(sucuId, page = 1, limit = 20, tipo = null, ordenamiento = 'fecha_desc') {
    try {
      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const offset = (page - 1) * limit;

      let query = supabase
        .from('movimientos_acopio')
        .select(`
          *,
          product:product_id (
            id,
            name,
            description,
            quantity,
            type_measure:type_measure_id (
              id,
              name,
              code
            )
          ),
          proveedor:proveedor_id (
            id,
            name
          ),
          cliente:cliente_id (
            id,
            name
          )
        `, { count: 'exact' })
        .eq('sucu_id', sucuId);

      // Aplicar filtro de tipo si se especifica
      if (tipo) {
        query = query.eq('type', tipo);
      }

      // Aplicar ordenamiento
      let orderColumn = 'date';
      let ascending = false;

      switch (ordenamiento) {
        case 'fecha_asc':
          orderColumn = 'date';
          ascending = true;
          break;
        case 'fecha_desc':
          orderColumn = 'date';
          ascending = false;
          break;
        case 'tipo_asc':
          orderColumn = 'type';
          ascending = true;
          break;
        case 'tipo_desc':
          orderColumn = 'type';
          ascending = false;
          break;
        default:
          orderColumn = 'date';
          ascending = false;
      }

      query = query
        .order(orderColumn, { ascending })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error('No se pudo obtener los movimientos');
      }

      return {
        movimientos: data || [],
        total: count || 0
      };
    } catch (error) {
      console.error('Error al obtener los movimientos:', error);
      throw new Error('No se pudo obtener los movimientos');
    }
  }

  // Obtener movimientos por cliente
  static async getByCliente(clienteId, sucuId, page = 1, limit = 20) {
    try {
      if (!clienteId) {
        throw new Error('ID del cliente es requerido');
      }

      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      // Normalizar el UUID a minúsculas para evitar problemas de case
      const normalizedClienteId = clienteId.toLowerCase();
      const offset = (page - 1) * limit;

      const { data: movimientos, error } = await supabase
        .from('movimientos_acopio')
        .select(`
          *,
          product:product_id (
            id,
            name,
            description,
            quantity,
            type_measure:type_measure_id (
              id,
              name,
              code
            )
          ),
          cliente:cliente_id (
            id,
            name
          )
        `, { count: 'exact' })
        .eq('cliente_id', normalizedClienteId)
        .eq('sucu_id', sucuId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Error al obtener movimientos: ${error.message}`);
      }

      const { count, error: countError } = await supabase
        .from('movimientos_acopio')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', normalizedClienteId)
        .eq('sucu_id', sucuId);

      if (countError) {
        throw new Error(`Error al contar movimientos: ${countError.message}`);
      }

      return movimientos || [];

    } catch (error) {
      console.error('Error en movimientosAcopio.getByCliente:', error);
      throw error;
    }
  }

  // Obtener movimientos por proveedor
  static async getByProveedor(proveedorId, sucuId, page = 1, limit = 20) {
    try {
      if (!proveedorId) {
        throw new Error('ID del proveedor es requerido');
      }

      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const offset = (page - 1) * limit;

      // Normalizar el UUID a minúsculas para evitar problemas de case
      const normalizedProveedorId = proveedorId.toLowerCase();

      const { data: movimientos, error } = await supabase
        .from('movimientos_acopio')
        .select(`
          *,
          product:product_id (
            id,
            name,
            description,
            quantity,
            type_measure:type_measure_id (
              id,
              name,
              code
            )
          ),
          proveedor:proveedor_id (
            id,
            name
          )
        `, { count: 'exact' })
        .eq('proveedor_id', normalizedProveedorId)
        .eq('sucu_id', sucuId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Error al obtener movimientos: ${error.message}`);
      }

      const { count, error: countError } = await supabase
        .from('movimientos_acopio')
        .select('*', { count: 'exact', head: true })
        .eq('proveedor_id', normalizedProveedorId)
        .eq('sucu_id', sucuId);

      if (countError) {
        throw new Error(`Error al contar movimientos: ${countError.message}`);
      }

      return movimientos || [];

    } catch (error) {
      console.error('Error en movimientosAcopio.getByProveedor:', error);
      throw error;
    }
  }

  // Método para restar ingredientes del stock cuando se hace una entrada con receta
  static async restarIngredientes(productoPrincipal, cantidadEntrada, ingredientes, empresaId) {
    try {
      for (const ingrediente of ingredientes) {
        // Verificar estructura del ingrediente
        if (!ingrediente.products_acopio || !ingrediente.products_acopio.id) {
          continue;
        }

        // Calcular cantidad a restar
        const cantidadARestar = ingrediente.cantidad * cantidadEntrada;

        // Obtener cantidad actual del ingrediente
        const cantidadActual = ingrediente.products_acopio.quantity;

        // Calcular nueva cantidad
        const nuevaCantidad = cantidadActual - cantidadARestar;

        // Verificar que hay suficiente stock
        if (nuevaCantidad < 0) {
          console.warn(`Stock insuficiente para ingrediente ${ingrediente.products_acopio.name}. Stock actual: ${cantidadActual}, Requerido: ${cantidadARestar}`);
          continue; // Saltar este ingrediente si no hay suficiente stock
        }

        // Actualizar el stock del ingrediente (SIN crear movimiento)
        const { error: updateError } = await supabase
          .from('products_acopio')
          .update({ quantity: nuevaCantidad })
          .eq('id', ingrediente.products_acopio.id);

        if (updateError) {
          console.error(`Error actualizando stock del ingrediente ${ingrediente.products_acopio.name}:`, updateError);
          continue; // Continuar con el siguiente ingrediente
        }
      }

      return { success: true, message: 'Ingredientes restados correctamente' };
    } catch (error) {
      console.error('Error en restarIngredientes:', error);
      throw new Error('Error al restar ingredientes del stock');
    }
  }

  // Anular un movimiento
  static async anular(movimientoId) {
    try {
      // Obtener el movimiento con todos sus datos
      const { data: movimiento, error: movimientoError } = await supabase
        .from('movimientos_acopio')
        .select(`
          *,
          product:product_id (
            id,
            name,
            quantity,
            recetas_acopio (
              id,
              description,
              recetas_acopio_detalle (
                id,
                cantidad,
                products_acopio:producto_acopio_id (
                  id,
                  name,
                  quantity
                )
              )
            )
          )
        `)
        .eq('id', movimientoId)
        .single();

      if (movimientoError) {
        console.error('Error obteniendo movimiento:', movimientoError);
        return { success: false, message: 'Movimiento no encontrado' };
      }

      if (!movimiento) {
        return { success: false, message: 'Movimiento no encontrado' };
      }

      // Verificar que no esté ya anulado
      if (movimiento.estado === 'anulado') {
        return { success: false, message: 'El movimiento ya está anulado' };
      }

      // Actualizar estado a anulado
      const { error: updateError } = await supabase
        .from('movimientos_acopio')
        .update({ estado: 'anulado' })
        .eq('id', movimientoId);

      if (updateError) {
        console.error('Error actualizando estado:', updateError);
        return { success: false, message: 'Error al anular el movimiento' };
      }

      // Revertir el stock del producto principal
      const cantidadMovimiento = parseFloat(movimiento.quantity);
      let nuevaCantidad;

      if (movimiento.type === 'entrada') {
        // Anular entrada = restar del stock
        nuevaCantidad = movimiento.product.quantity - cantidadMovimiento;
      } else {
        // Anular salida = sumar al stock
        nuevaCantidad = movimiento.product.quantity + cantidadMovimiento;
      }

      // Actualizar stock del producto principal
      const { error: stockError } = await supabase
        .from('products_acopio')
        .update({ quantity: nuevaCantidad })
        .eq('id', movimiento.product_id);

      if (stockError) {
        console.error('Error actualizando stock:', stockError);
        // Revertir el estado del movimiento
        await supabase
          .from('movimientos_acopio')
          .update({ estado: 'activo' })
          .eq('id', movimientoId);
        return { success: false, message: 'Error al actualizar el stock' };
      }

      // Si es entrada y tiene receta, devolver ingredientes consumidos
      if (movimiento.type === 'entrada' && movimiento.product.recetas_acopio && movimiento.product.recetas_acopio.length > 0) {
        const receta = movimiento.product.recetas_acopio[0];
        
        if (receta && receta.recetas_acopio_detalle && receta.recetas_acopio_detalle.length > 0) {
          // Devolver ingredientes (sumar al stock)
          for (const ingrediente of receta.recetas_acopio_detalle) {
            if (!ingrediente.products_acopio || !ingrediente.products_acopio.id) {
              continue;
            }

            const cantidadADevolver = ingrediente.cantidad * cantidadMovimiento;
            const cantidadActual = ingrediente.products_acopio.quantity;
            const nuevaCantidadIngrediente = cantidadActual + cantidadADevolver;

            const { error: ingredienteError } = await supabase
              .from('products_acopio')
              .update({ quantity: nuevaCantidadIngrediente })
              .eq('id', ingrediente.products_acopio.id);

            if (ingredienteError) {
              console.error(`Error devolviendo ingrediente ${ingrediente.products_acopio.name}:`, ingredienteError);
              // Continuar con el siguiente ingrediente
            }
          }
        }
      }

      return { 
        success: true, 
        message: 'Movimiento anulado correctamente',
        data: { ...movimiento, estado: 'anulado' }
      };

    } catch (error) {
      console.error('Error en anular movimiento:', error);
      return { success: false, message: 'Error interno del servidor' };
    }
  }

  // Eliminar un movimiento
  static async eliminar(movimientoId) {
    try {
      // Verificar que el movimiento existe
      const { data: movimiento, error: movimientoError } = await supabase
        .from('movimientos_acopio')
        .select('id, estado')
        .eq('id', movimientoId)
        .single();

      if (movimientoError) {
        console.error('Error obteniendo movimiento:', movimientoError);
        return { success: false, message: 'Movimiento no encontrado' };
      }

      if (!movimiento) {
        return { success: false, message: 'Movimiento no encontrado' };
      }

      // Verificar que esté anulado
      if (movimiento.estado !== 'anulado') {
        return { success: false, message: 'Solo se pueden eliminar movimientos anulados' };
      }

      // Eliminar el movimiento
      const { error: deleteError } = await supabase
        .from('movimientos_acopio')
        .delete()
        .eq('id', movimientoId);

      if (deleteError) {
        console.error('Error eliminando movimiento:', deleteError);
        return { success: false, message: 'Error al eliminar el movimiento' };
      }

      return { 
        success: true, 
        message: 'Movimiento eliminado correctamente'
      };

    } catch (error) {
      console.error('Error en eliminar movimiento:', error);
      return { success: false, message: 'Error interno del servidor' };
    }
  }
}

module.exports = movimientosAcopio;
