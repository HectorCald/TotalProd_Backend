const { supabase } = require('../config/supabase');

class pedidosAlmacen {
  // Crear un pedido
  static async create(pedidoData, userId, empresaId, personalId = null, sucuId = null) {
    try {
      if (!pedidoData.productos || !Array.isArray(pedidoData.productos) || pedidoData.productos.length === 0) {
        throw new Error('La lista de productos es requerida');
      }

      if (!userId && !personalId) {
        throw new Error('ID del usuario o personal es requerido');
      }

      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      if (!pedidoData.precio_id) {
        throw new Error('ID del precio es requerido');
      }

      if (!pedidoData.pedido_sucursal_id) {
        throw new Error('ID de la sucursal de destino es requerido');
      }

      // Crear timestamp en zona horaria de Bolivia (GMT-4)
      const ahora = new Date();
      const ahoraBolivia = new Date(ahora.getTime() - (4 * 60 * 60 * 1000)); // Restar 4 horas

      // Crear el pedido principal
      const pedidoPrincipal = {
        empresa_id: empresaId,
        sucu_id: sucuId,
        precio_id: pedidoData.precio_id,
        pedido_sucursal_id: pedidoData.pedido_sucursal_id,
        observaciones: pedidoData.observaciones || null,
        estado: 'Pendiente',
        fecha: ahoraBolivia.toISOString() // Usar timestamp en zona horaria de Bolivia
      };

      // Solo agregar user_id o personal_id si tienen valor
      // IMPORTANTE: No enviar campos null para evitar problemas de foreign key
      if (userId && userId !== null) {
        pedidoPrincipal.user_id = userId;
      }
      if (personalId && personalId !== null) {
        pedidoPrincipal.personal_id = personalId;
      }

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

      // Obtener nombres de usuario y personal
      let user = null;
      let personal = null;

      // Si tiene user_id, obtener el usuario
      if (pedidoCompleto.user_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('id', pedidoCompleto.user_id)
          .single();
        user = {
          id: userData.id,
          name: `${userData.first_name} ${userData.last_name}`.trim()
        };
      }

      // Si tiene personal_id, obtener el personal
      if (pedidoCompleto.personal_id) {
        const { data: personalData } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .eq('id', pedidoCompleto.personal_id)
          .single();
        personal = {
          id: personalData.id,
          name: `${personalData.first_name} ${personalData.last_name}`.trim()
        };
      }

      const pedidoConNombres = {
        ...pedidoCompleto,
        user,
        personal
      };

      return {
        success: true,
        message: 'Pedido creado exitosamente',
        data: pedidoConNombres
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.create:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Obtener todos los pedidos de la sucursal (pedidos que hizo o que están destinados a esta sucursal)
  static async getAll(sucuId, page = 1, limit = 20) {
    try {
      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
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
          ),
          sucursal:sucu_id (
            id,
            name
          ),
          sucursal_destino:pedido_sucursal_id (
            id,
            name
          ),
          precio:prices_types (
            id,
            name
          )
        `)
        .or(`sucu_id.eq.${sucuId},pedido_sucursal_id.eq.${sucuId}`)
        .order('fecha', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Error al obtener pedidos: ${error.message}`);
      }

      // Obtener nombres de usuarios y personal para cada pedido
      const pedidosConNombres = await Promise.all(
        pedidos.map(async (pedido) => {
          let user = null;
          let personal = null;

          // Si tiene user_id, obtener el usuario
          if (pedido.user_id) {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('id, first_name, last_name')
              .eq('id', pedido.user_id)
              .single();
            
            if (!userError && userData) {
              user = {
                id: userData.id,
                name: `${userData.first_name} ${userData.last_name}`.trim()
              };
            }
          }

          // Si tiene personal_id, obtener el personal
          if (pedido.personal_id) {
            const { data: personalData, error: personalError } = await supabase
              .from('personal')
              .select('id, first_name, last_name')
              .eq('id', pedido.personal_id)
              .single();
            
            if (!personalError && personalData) {
              personal = {
                id: personalData.id,
                name: `${personalData.first_name} ${personalData.last_name}`.trim()
              };
            }
          }

          return {
            ...pedido,
            user,
            personal
          };
        })
      );

      // Obtener el total de pedidos para la paginación
      const { count, error: countError } = await supabase
        .from('pedidos_almacen')
        .select('*', { count: 'exact', head: true })
        .or(`sucu_id.eq.${sucuId},pedido_sucursal_id.eq.${sucuId}`);

      if (countError) {
        throw new Error(`Error al contar pedidos: ${countError.message}`);
      }

      return {
        success: true,
        message: 'Pedidos obtenidos exitosamente',
        data: pedidosConNombres,
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
  static async getById(pedidoId) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
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
          ),
          sucursal:sucu_id (
            id,
            name
          ),
          sucursal_destino:pedido_sucursal_id (
            id,
            name
          ),
          precio:prices_types (
            id,
            name
          )
        `)
        .eq('id', pedidoId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al obtener el pedido: ${error.message}`);
      }

      // Obtener nombres de usuario y personal
      let user = null;
      let personal = null;

      // Si tiene user_id, obtener el usuario
      if (pedido.user_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('id', pedido.user_id)
          .single();
        user = {
          id: userData.id,
          name: `${userData.first_name} ${userData.last_name}`.trim()
        };
      }

      // Si tiene personal_id, obtener el personal
      if (pedido.personal_id) {
        const { data: personalData } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .eq('id', pedido.personal_id)
          .single();
        personal = {
          id: personalData.id,
          name: `${personalData.first_name} ${personalData.last_name}`.trim()
        };
      }

      const pedidoConNombres = {
        ...pedido,
        user,
        personal
      };

      return {
        success: true,
        message: 'Pedido obtenido exitosamente',
        data: pedidoConNombres
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.getById:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Actualizar pedido completo
  static async update(pedidoId, pedidoData, userId, empresaId, personalId = null) {
    try {
      if (!pedidoData.productos || !Array.isArray(pedidoData.productos) || pedidoData.productos.length === 0) {
        throw new Error('La lista de productos es requerida');
      }

      if (!userId && !personalId) {
        throw new Error('ID del usuario o personal es requerido');
      }

      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // Verificar que el pedido existe
      const { data: pedidoExistente, error: fetchError } = await supabase
        .from('pedidos_almacen')
        .select('id')
        .eq('id', pedidoId)
        .single();

      if (fetchError || !pedidoExistente) {
        throw new Error('Pedido no encontrado');
      }

      // Actualizar el pedido principal (solo observaciones, precio_id y pedido_sucursal_id, NO sucursal/empresa)
      const pedidoPrincipal = {
        observaciones: pedidoData.observaciones || null,
        precio_id: pedidoData.precio_id || null,
        pedido_sucursal_id: pedidoData.pedido_sucursal_id || null
      };

      const { error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .update(pedidoPrincipal)
        .eq('id', pedidoId);

      if (pedidoError) {
        throw new Error(`Error al actualizar el pedido: ${pedidoError.message}`);
      }

      // Eliminar los detalles existentes
      const { error: deleteDetallesError } = await supabase
        .from('pedido_almacen_detalle')
        .delete()
        .eq('pedido_almacen_id', pedidoId);

      if (deleteDetallesError) {
        throw new Error(`Error al eliminar detalles existentes: ${deleteDetallesError.message}`);
      }

      // Crear los nuevos detalles del pedido
      const detalles = pedidoData.productos.map(producto => ({
        pedido_almacen_id: pedidoId,
        producto_almacen_id: producto.id,
        cantidad: producto.cantidad,
        precio: producto.precio || 0
      }));

      const { error: detallesError } = await supabase
        .from('pedido_almacen_detalle')
        .insert(detalles);

      if (detallesError) {
        throw new Error(`Error al crear los nuevos detalles del pedido: ${detallesError.message}`);
      }

      // Obtener el pedido completo actualizado con detalles
      const { data: pedidoCompleto, error: fetchCompletoError } = await supabase
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
          ),
          sucursal:sucu_id (
            id,
            name
          ),
          sucursal_destino:pedido_sucursal_id (
            id,
            name
          ),
          precio:prices_types (
            id,
            name
          )
        `)
        .eq('id', pedidoId)
        .single();

      if (fetchCompletoError) {
        throw new Error(`Error al obtener el pedido actualizado: ${fetchCompletoError.message}`);
      }

      // Obtener nombres de usuario y personal
      let user = null;
      let personal = null;

      // Si tiene user_id, obtener el usuario
      if (pedidoCompleto.user_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('id', pedidoCompleto.user_id)
          .single();
        user = {
          id: userData.id,
          name: `${userData.first_name} ${userData.last_name}`.trim()
        };
      }

      // Si tiene personal_id, obtener el personal
      if (pedidoCompleto.personal_id) {
        const { data: personalData } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .eq('id', pedidoCompleto.personal_id)
          .single();
        personal = {
          id: personalData.id,
          name: `${personalData.first_name} ${personalData.last_name}`.trim()
        };
      }

      const pedidoConNombres = {
        ...pedidoCompleto,
        user,
        personal
      };

      return {
        success: true,
        message: 'Pedido actualizado exitosamente',
        data: pedidoConNombres
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.update:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Actualizar entrega de pedido (solo precio, productos y cantidades)
  static async updateEntrega(pedidoId, pedidoData) {
    try {
      if (!pedidoData.productos || !Array.isArray(pedidoData.productos) || pedidoData.productos.length === 0) {
        throw new Error('La lista de productos es requerida');
      }

      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!pedidoData.movimiento_id) {
        throw new Error('ID del movimiento es requerido');
      }

      // Verificar que el pedido existe
      const { data: pedidoExistente, error: fetchError } = await supabase
        .from('pedidos_almacen')
        .select('id')
        .eq('id', pedidoId)
        .single();

      if (fetchError || !pedidoExistente) {
        throw new Error('Pedido no encontrado');
      }

      // Actualizar precio_id, estado y movimiento_id del pedido principal
      const pedidoPrincipal = {
        precio_id: pedidoData.precio_id || null,
        estado: 'Enviado',
        movimiento_id: pedidoData.movimiento_id
      };

      const { error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .update(pedidoPrincipal)
        .eq('id', pedidoId);

      if (pedidoError) {
        throw new Error(`Error al actualizar el pedido: ${pedidoError.message}`);
      }

      // Eliminar los detalles existentes
      const { error: deleteDetallesError } = await supabase
        .from('pedido_almacen_detalle')
        .delete()
        .eq('pedido_almacen_id', pedidoId);

      if (deleteDetallesError) {
        throw new Error(`Error al eliminar detalles existentes: ${deleteDetallesError.message}`);
      }

      // Crear los nuevos detalles del pedido
      const detalles = pedidoData.productos.map(producto => ({
        pedido_almacen_id: pedidoId,
        producto_almacen_id: producto.id,
        cantidad: producto.cantidad,
        precio: producto.precio || 0
      }));

      const { error: detallesError } = await supabase
        .from('pedido_almacen_detalle')
        .insert(detalles);

      if (detallesError) {
        throw new Error(`Error al crear los nuevos detalles del pedido: ${detallesError.message}`);
      }

      // Obtener el pedido completo actualizado con detalles
      const { data: pedidoCompleto, error: fetchCompletoError } = await supabase
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
          ),
          sucursal:sucu_id (
            id,
            name
          ),
          sucursal_destino:pedido_sucursal_id (
            id,
            name
          ),
          precio:prices_types (
            id,
            name
          )
        `)
        .eq('id', pedidoId)
        .single();

      if (fetchCompletoError) {
        throw new Error(`Error al obtener el pedido actualizado: ${fetchCompletoError.message}`);
      }

      // Obtener nombres de usuario y personal
      let user = null;
      let personal = null;

      // Si tiene user_id, obtener el usuario
      if (pedidoCompleto.user_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('id', pedidoCompleto.user_id)
          .single();
        user = {
          id: userData.id,
          name: `${userData.first_name} ${userData.last_name}`.trim()
        };
      }

      // Si tiene personal_id, obtener el personal
      if (pedidoCompleto.personal_id) {
        const { data: personalData } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .eq('id', pedidoCompleto.personal_id)
          .single();
        personal = {
          id: personalData.id,
          name: `${personalData.first_name} ${personalData.last_name}`.trim()
        };
      }

      const pedidoConNombres = {
        ...pedidoCompleto,
        user,
        personal
      };

      return {
        success: true,
        message: 'Pedido entregado exitosamente',
        data: pedidoConNombres
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.updateEntrega:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Actualizar estado del pedido
  static async updateEstado(pedidoId, nuevoEstado, movimientoEntradaId = null) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!nuevoEstado) {
        throw new Error('Nuevo estado es requerido');
      }

      // Preparar datos para actualizar
      const updateData = { estado: nuevoEstado };
      
      // Si se cambia a 'Pendiente', limpiar el movimiento_id
      if (nuevoEstado === 'Pendiente') {
        updateData.movimiento_id = null;
      }
      
      // Si se proporciona un movimiento_entrada_id, agregarlo
      if (movimientoEntradaId) {
        updateData.movimiento_entrada_id = movimientoEntradaId;
      }

      const { data, error } = await supabase
        .from('pedidos_almacen')
        .update(updateData)
        .eq('id', pedidoId)
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

  // Eliminar pedido (elimina primero los detalles, luego el pedido)
  static async eliminar(pedidoId) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      // Primero eliminar los detalles del pedido
      const { error: detallesError } = await supabase
        .from('pedido_almacen_detalle')
        .delete()
        .eq('pedido_almacen_id', pedidoId);

      if (detallesError) {
        throw new Error(`Error al eliminar los detalles del pedido: ${detallesError.message}`);
      }

      // Luego eliminar el pedido principal
      const { error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .delete()
        .eq('id', pedidoId);

      if (pedidoError) {
        if (pedidoError.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al eliminar el pedido: ${pedidoError.message}`);
      }

      return {
        success: true,
        message: 'Pedido eliminado exitosamente'
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.eliminar:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = pedidosAlmacen;
