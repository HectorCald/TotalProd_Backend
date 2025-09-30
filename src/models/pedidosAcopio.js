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
  static async getAll(empresaId, page = 1, limit = 10, searchQuery = null, estado = null, ordenamiento = 'fecha_desc') {
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

      // La búsqueda se aplicará post-consulta para poder filtrar por nombre del producto

      // Aplicar filtro de estado si se proporciona
      if (estado && estado.trim() !== '') {
        query = query.eq('estado', estado);
      }

      const { data: pedidos, error } = await query;

      if (error) {
        throw new Error(`Error al obtener pedidos: ${error.message}`);
      }

      // Filtrar por nombre del producto si hay búsqueda
      let pedidosFiltrados = pedidos;
      if (searchQuery && searchQuery.trim() !== '') {
        const searchLower = searchQuery.toLowerCase();
        pedidosFiltrados = pedidos.filter(pedido => {
          const productoName = pedido.producto_acopio?.name?.toLowerCase() || '';
          const observaciones = pedido.observaciones?.toLowerCase() || '';
          return productoName.includes(searchLower) || observaciones.includes(searchLower);
        });
      }

      // Obtener nombres de usuarios y personal para cada pedido
      const pedidosConNombres = await Promise.all(
        pedidosFiltrados.map(async (pedido) => {
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
  static async updateEstado(pedidoId, nuevoEstado, userId, movimientoEntradaId = null) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!nuevoEstado) {
        throw new Error('Nuevo estado es requerido');
      }

      // Preparar datos para actualizar
      const updateData = { estado: nuevoEstado };
      
      // Si se proporciona un movimiento_entrada_id, agregarlo
      if (movimientoEntradaId) {
        updateData.movimiento_entrada_id = movimientoEntradaId;
      }

      const { data, error } = await supabase
        .from('pedidos_acopio')
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

  // Entregar pedido
  static async entregar(pedidoId, entregaData, userId) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!entregaData) {
        throw new Error('Datos de entrega son requeridos');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Obtener el pedido primero para validar que existe y obtener el nombre del producto
      const { data: pedidoExistente, error: pedidoError } = await supabase
        .from('pedidos_acopio')
        .select(`
          id, 
          estado, 
          producto_acopio_id, 
          cantidad, 
          tipo_medida,
          producto_acopio:producto_acopio_id (
            id,
            name
          )
        `)
        .eq('id', pedidoId)
        .single();

      if (pedidoError) {
        if (pedidoError.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al obtener el pedido: ${pedidoError.message}`);
      }

      if (pedidoExistente.estado === 'Entregado') {
        throw new Error('El pedido ya ha sido entregado');
      }

      // Crear el gasto primero
      const gastosModel = require('./gastos');
      const nombreProducto = pedidoExistente.producto_acopio?.name || 'Producto';
      const concepto = `${nombreProducto} - ${entregaData.cantidadEntregada} ${entregaData.unidadEntregada}`;
      
      const gastoData = {
        concepto: concepto,
        valor: entregaData.costo,
        metodo_pago: entregaData.metodo_pago,
        proveedor_id: entregaData.proveedor_id,
        observaciones: entregaData.observaciones || null,
        fecha_gasto: new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
      };

      // Obtener el sucu_id del pedido para el gasto
      const { data: pedidoConSucursal, error: pedidoError2 } = await supabase
        .from('pedidos_acopio')
        .select('sucu_id')
        .eq('id', pedidoId)
        .single();

      if (pedidoError2) {
        throw new Error(`Error al obtener sucursal del pedido: ${pedidoError2.message}`);
      }

      const gastoResult = await gastosModel.create({
        ...gastoData,
        user_id: userId,
        sucu_id: pedidoConSucursal.sucu_id
      });

      if (!gastoResult.success) {
        throw new Error(`Error al crear el gasto: ${gastoResult.message}`);
      }

      console.log('Gasto creado:', gastoResult.data);
      console.log('Gasto ID:', gastoResult.data.id);

      // Actualizar el pedido con los datos de entrega
      const { data: pedidoActualizado, error: updateError } = await supabase
        .from('pedidos_acopio')
        .update({
          estado: 'Entregado',
          fecha_entregado: entregaData.fecha_entregado,
          entregado_por: entregaData.entregado_por,
          cantidad_entregada: parseFloat(entregaData.cantidadEntregada),
          cantidad_entregada_ud: parseInt(entregaData.cantidadUD),
          estado_entrega: entregaData.estado_entrega,
          observaciones_entrega: entregaData.observaciones || null,
          gasto_id: gastoResult.data.id
        })
        .eq('id', pedidoId)
        .select(`
          *,
          producto_acopio:producto_acopio_id (
            id,
            name,
            description
          ),
          gasto:gasto_id (
            id,
            concepto,
            valor,
            metodo_pago,
            fecha_gasto
          )
        `)
        .single();

      if (updateError) {
        throw new Error(`Error al actualizar el pedido: ${updateError.message}`);
      }

      return {
        success: true,
        message: 'Pedido entregado exitosamente',
        data: pedidoActualizado
      };

    } catch (error) {
      console.error('Error en pedidosAcopio.entregar:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Anular entrega de pedido
  static async anularEntrega(pedidoId, userId) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!userId) {
        throw new Error('ID del usuario es requerido');
      }

      // Obtener el pedido para validar que existe y tiene gasto_id
      const { data: pedidoExistente, error: pedidoError } = await supabase
        .from('pedidos_acopio')
        .select('id, estado, gasto_id')
        .eq('id', pedidoId)
        .single();

      if (pedidoError) {
        if (pedidoError.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al obtener el pedido: ${pedidoError.message}`);
      }

      if (pedidoExistente.estado !== 'Entregado') {
        throw new Error('Solo se pueden anular pedidos en estado Entregado');
      }

      if (!pedidoExistente.gasto_id) {
        throw new Error('El pedido no tiene un gasto asociado');
      }

      // Primero limpiar todos los campos de entrega del pedido (incluyendo gasto_id)
      const { data: pedidoActualizado, error: updateError } = await supabase
        .from('pedidos_acopio')
        .update({
          estado: 'Pendiente',
          fecha_entregado: null,
          entregado_por: null,
          cantidad_entregada: null,
          cantidad_entregada_ud: null,
          estado_entrega: null,
          observaciones_entrega: null,
          gasto_id: null
        })
        .eq('id', pedidoId)
        .select(`
          *,
          producto_acopio:producto_acopio_id (
            id,
            name,
            description
          )
        `)
        .single();

      if (updateError) {
        throw new Error(`Error al limpiar los datos de entrega: ${updateError.message}`);
      }

      // Ahora eliminar el gasto (ya no hay referencia en el pedido)
      const gastosModel = require('./gastos');
      const gastoResult = await gastosModel.delete(pedidoExistente.gasto_id);

      if (!gastoResult.success) {
        throw new Error(`Error al eliminar el gasto: ${gastoResult.message}`);
      }

      console.log('Gasto eliminado:', gastoResult.message);

      return {
        success: true,
        message: 'Entrega anulada exitosamente',
        data: pedidoActualizado
      };

    } catch (error) {
      console.error('Error en pedidosAcopio.anularEntrega:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = pedidosAcopio;