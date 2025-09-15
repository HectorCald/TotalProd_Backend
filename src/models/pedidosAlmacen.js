const { supabase } = require('../config/supabase');

class pedidosAlmacen {
  // Crear un pedido
  static async create(pedidoData, userId) {
    try {
      if (!pedidoData.productos || !Array.isArray(pedidoData.productos) || pedidoData.productos.length === 0) {
        throw new Error('La lista de productos es requerida');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Crear el pedido principal
      const pedidoPrincipal = {
        user_id: userId,
        observaciones: pedidoData.observaciones || null,
        estado: 'Pendiente'
      };

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .insert(pedidoPrincipal)
        .select('id')
        .single();

      if (pedidoError) {
        throw new Error(`Error al crear el pedido: ${pedidoError.message}`);
      }

      // Crear los detalles del pedido
      const detalles = pedidoData.productos.map(producto => ({
        pedido_almacen_id: pedido.id,
        producto_almacen_id: producto.id,
        cantidad: producto.cantidad,
        precio: producto.precio || 0
      }));

      const { error: detallesError } = await supabase
        .from('pedido_almacen_detalle')
        .insert(detalles);

      if (detallesError) {
        // Si hay error en los detalles, eliminar el pedido principal
        await supabase
          .from('pedidos_almacen')
          .delete()
          .eq('id', pedido.id);
        
        throw new Error(`Error al crear los detalles del pedido: ${detallesError.message}`);
      }

      // Obtener el pedido completo con detalles
      const { data: pedidoCompleto, error: fetchError } = await supabase
        .from('pedidos_almacen')
        .select(`
          *,
          pedido_almacen_detalle (
            *,
            producto_almacen:producto_almacen_id (
              id,
              name,
              description
            )
          )
        `)
        .eq('id', pedido.id)
        .single();

      if (fetchError) {
        throw new Error(`Error al obtener el pedido creado: ${fetchError.message}`);
      }

      return {
        success: true,
        message: 'Pedido creado exitosamente',
        data: pedidoCompleto
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.create:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Obtener todos los pedidos del usuario
  static async getAll(userId, page = 1, limit = 20) {
    try {
      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const offset = (page - 1) * limit;

      const { data: pedidos, error } = await supabase
        .from('pedidos_almacen')
        .select(`
          *,
          pedido_almacen_detalle (
            *,
            producto_almacen:producto_almacen_id (
              id,
              name,
              description
            )
          )
        `)
        .eq('user_id', userId)
        .order('fecha', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Error al obtener pedidos: ${error.message}`);
      }

      // Obtener el total de pedidos para la paginación
      const { count, error: countError } = await supabase
        .from('pedidos_almacen')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        throw new Error(`Error al contar pedidos: ${countError.message}`);
      }

      return {
        success: true,
        message: 'Pedidos obtenidos exitosamente',
        data: pedidos,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          hasNextPage: page < Math.ceil(count / limit)
        }
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.getAll:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Obtener un pedido por ID
  static async getById(pedidoId, userId) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data: pedido, error } = await supabase
        .from('pedidos_almacen')
        .select(`
          *,
          pedido_almacen_detalle (
            *,
            producto_almacen:producto_almacen_id (
              id,
              name,
              description
            )
          )
        `)
        .eq('id', pedidoId)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al obtener el pedido: ${error.message}`);
      }

      return {
        success: true,
        message: 'Pedido obtenido exitosamente',
        data: pedido
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.getById:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Actualizar estado del pedido
  static async updateEstado(pedidoId, nuevoEstado, userId) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!nuevoEstado) {
        throw new Error('Nuevo estado es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      const { data, error } = await supabase
        .from('pedidos_almacen')
        .update({ estado: nuevoEstado })
        .eq('id', pedidoId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al actualizar el pedido: ${error.message}`);
      }

      return {
        success: true,
        message: 'Estado del pedido actualizado exitosamente',
        data: data
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.updateEstado:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Verificar si un producto tiene pedidos asociados
  static async verificarProductoEnPedidos(productoId) {
    try {
      if (!productoId) {
        throw new Error('ID del producto es requerido');
      }

      const { data, error } = await supabase
        .from('pedido_almacen_detalle')
        .select('id')
        .eq('producto_almacen_id', productoId)
        .limit(1);

      if (error) {
        throw new Error(`Error al verificar pedidos: ${error.message}`);
      }

      const tienePedidos = data && data.length > 0;

      return {
        success: true,
        message: 'Verificación completada',
        data: {
          tienePedidos,
          cantidadPedidos: data ? data.length : 0
        }
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.verificarProductoEnPedidos:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = pedidosAlmacen;
