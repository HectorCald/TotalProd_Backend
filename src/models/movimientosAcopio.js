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

      const dbData = {
        product_id: movimientoData.product_id,
        user_id: userId,
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
        .eq('user_id', userId)
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
      } else {
        throw new Error('Tipo de movimiento inválido');
      }

      // Actualizar la cantidad del producto
      const { error: errorUpdate } = await supabase
        .from('products_acopio')
        .update({ quantity: nuevaCantidad })
        .eq('id', movimientoData.product_id)
        .eq('user_id', userId);

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
  static async getByProduct(productId, userId) {
    try {
      if (!productId) {
        throw new Error('ID del producto es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
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
        .eq('user_id', userId)
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

  // Obtener todos los movimientos paginados
  static async getAllPaginated(userId, { page, limit, offset }) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

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
          )
        `, { count: 'exact' })
        .eq('user_id', userId);

      // Aplicar paginación y ordenamiento
      query = query
        .order('created_at', { ascending: false })
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
      console.error('Error al obtener los movimientos paginados:', error);
      throw new Error('No se pudo obtener los movimientos');
    }
  }
}

module.exports = movimientosAcopio;
