const { supabase } = require('../config/supabase');

class pedidosAcopio {
  // Crear un pedido (un registro por cada producto)
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

      // Crear un registro por cada producto
      const pedidos = pedidoData.productos.map(producto => {
        const pedido = {
          empresa_id: empresaId,
          sucu_id: sucuId,
          observaciones: pedidoData.observaciones || null,
          estado: 'Pendiente',
          producto_acopio_id: producto.id,
          cantidad: producto.cantidad,
          tipo_medida: producto.medidaPedido || 'kg'
        };

        // Solo incluir user_id o personal_id si no son null
        if (userId && userId !== null) {
          pedido.user_id = userId;
        }
        if (personalId && personalId !== null) {
          pedido.personal_id = personalId;
        }

        return pedido;
      });

      const { data: pedidosCreados, error: pedidosError } = await supabase
        .from('pedidos_acopio')
        .insert(pedidos)
        .select(`
          *,
          producto_acopio:producto_acopio_id (
            id,
            name,
            description
          )
        `);

      if (pedidosError) {
        throw new Error(`Error al crear los pedidos: ${pedidosError.message}`);
      }

      return {
        success: true,
        message: 'Pedidos creados exitosamente',
        data: pedidosCreados
      };

    } catch (error) {
      console.error('Error en pedidosAcopio.create:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Obtener todos los pedidos de la empresa
  static async getAll(empresaId, page = 1, limit = 20, searchQuery = null, ordenamiento = 'fecha_desc') {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      const offset = (page - 1) * limit;

      // Configurar ordenamiento
      let orderBy = 'fecha';
      let ascending = false;
      
      switch (ordenamiento) {
        case 'fecha_asc':
          orderBy = 'fecha';
          ascending = true;
          break;
        case 'fecha_desc':
          orderBy = 'fecha';
          ascending = false;
          break;
        case 'estado_asc':
          orderBy = 'estado';
          ascending = true;
          break;
        case 'estado_desc':
          orderBy = 'estado';
          ascending = false;
          break;
        default:
          orderBy = 'fecha';
          ascending = false;
      }

      let query = supabase
        .from('pedidos_acopio')
        .select(`
          *,
          producto_acopio:producto_acopio_id (
            id,
            name,
            description
          ),
          sucursal:sucu_id (
            id,
            name
          )
        `)
        .eq('empresa_id', empresaId)
        .order(orderBy, { ascending: ascending })
        .range(offset, offset + limit - 1);

      // Aplicar búsqueda si se proporciona
      if (searchQuery && searchQuery.trim() !== '') {
        query = query.or(`observaciones.ilike.%${searchQuery}%,producto_acopio.name.ilike.%${searchQuery}%`);
      }

      const { data: pedidos, error } = await query;

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

      const { count, error: countError } = await supabase
        .from('pedidos_acopio')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId);

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
      console.error('Error en pedidosAcopio.getAll:', error);
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
        .from('pedidos_acopio')
        .select(`
          *,
          producto_acopio:producto_acopio_id (
            id,
            name,
            description
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
      console.error('Error en pedidosAcopio.getById:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Actualizar estado de un pedido
  static async updateEstado(pedidoId, nuevoEstado) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!nuevoEstado) {
        throw new Error('Nuevo estado es requerido');
      }

      const { data, error } = await supabase
        .from('pedidos_acopio')
        .update({ estado: nuevoEstado })
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
      console.error('Error en pedidosAcopio.updateEstado:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Verificar si un producto está en algún pedido
  static async verificarProductoEnPedidos(productoId) {
    try {
      if (!productoId) {
        throw new Error('ID del producto es requerido');
      }

      const { data, error } = await supabase
        .from('pedidos_acopio')
        .select('id')
        .eq('producto_acopio_id', productoId)
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
      console.error('Error en pedidosAcopio.verificarProductoEnPedidos:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Eliminar pedido
  static async eliminar(pedidoId) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      const { error } = await supabase
        .from('pedidos_acopio')
        .delete()
        .eq('id', pedidoId);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al eliminar el pedido: ${error.message}`);
      }

      return {
        success: true,
        message: 'Pedido eliminado exitosamente'
      };

    } catch (error) {
      console.error('Error en pedidosAcopio.eliminar:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = pedidosAcopio;