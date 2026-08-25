const { supabase } = require('../config/supabase');
const { aplicarFiltroFecha } = require('../utils/fechaRangeHelper');

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
          tipo_medida: producto.tipo_medida || producto.medidaPedido || 'kg'
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
  static async getAll(empresaId, page = 1, limit = 10, searchQuery = null, estado = null, ordenamiento = 'fecha_desc', responsableId = null, filtroFecha = null) {
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
        .select('*')
        .eq('empresa_id', empresaId)
        .order(orderBy, { ascending: ascending })
        .range(offset, offset + limit - 1);

      let normalizedResponsableId = null;
      if (responsableId && responsableId !== 'null' && responsableId !== 'undefined') {
        // Mantener como string para evitar problemas con UUIDs y TEXT IDs
        normalizedResponsableId = String(responsableId);
      }

      // Si hay búsqueda, pre-matchear IDs de productos por nombre y luego filtrar por observaciones
      let productoIdsFiltrados = null;
      if (searchQuery && searchQuery.trim() !== '') {
        const term = `%${searchQuery}%`;
        const { data: productosMatch, error: prodErr } = await supabase
          .from('products_acopio')
          .select('id, name')
          .ilike('name', term);
        if (prodErr) {
          console.error('[PedidosAcopioModel.getAll] products search error =>', prodErr);
        } else {
          productoIdsFiltrados = (productosMatch || []).map(p => p.id);
          console.log('[PedidosAcopioModel.getAll] products search =>', { term, productIds: productoIdsFiltrados.length });
        }
      }

      // Aplicar filtro de estado si se proporciona
      if (estado && estado.trim() !== '') {
        query = query.eq('estado', estado);
      }

      // Filtrar por solicitante (user_id o personal_id)
      if (normalizedResponsableId) {
        // El responsableId puede ser user_id o personal_id, intentamos ambos
        query = query.or(`user_id.eq.${normalizedResponsableId},personal_id.eq.${normalizedResponsableId}`);
      }

      // Aplicar filtro de fecha si se proporciona (incluyendo el día completo en zona horaria local)
      query = aplicarFiltroFecha(query, 'fecha', filtroFecha);

      const { data: pedidos, error } = await query;

      if (error) {
        throw new Error(`Error al obtener pedidos: ${error.message}`);
      }

      // Filtrar por producto (IDs pre-matcheados) u observaciones
      let pedidosFiltrados = pedidos;
      if (searchQuery && searchQuery.trim() !== '') {
        const searchLower = searchQuery.toLowerCase();
        pedidosFiltrados = pedidos.filter(pedido => {
          const matchProducto = Array.isArray(productoIdsFiltrados) && productoIdsFiltrados.length > 0
            ? productoIdsFiltrados.includes(pedido.producto_acopio_id)
            : false;
          const observaciones = pedido.observaciones?.toLowerCase() || '';
        
          return matchProducto || observaciones.includes(searchLower);
        });
      }

      // BATCH LOADING: Obtener datos relacionados en lotes
      // Obtener IDs únicos para batch loading
      const userIds = Array.from(new Set(pedidosFiltrados.map(p => p.user_id).filter(Boolean)));
      const personalIds = Array.from(new Set(pedidosFiltrados.map(p => p.personal_id).filter(Boolean)));
      const productoIds = Array.from(new Set(pedidosFiltrados.map(p => p.producto_acopio_id).filter(Boolean)));
      const sucursalIds = Array.from(new Set(pedidosFiltrados.map(p => p.sucu_id).filter(Boolean)));

      // 1) Usuarios en lote
      const userMap = new Map();
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', userIds);
        (usersData || []).forEach(u => {
          userMap.set(u.id, {
            id: u.id,
            name: `${u.first_name} ${u.last_name}`.trim()
          });
        });
      }

      // 2) Personal en lote
      const personalMap = new Map();
      if (personalIds.length > 0) {
        const { data: personalData } = await supabase
          .from('staff')
          .select('id, first_name, last_name')
          .in('id', personalIds);
        (personalData || []).forEach(p => {
          personalMap.set(p.id, {
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim()
          });
        });
      }

      // 3) Productos en lote
      const productoMap = new Map();
      if (productoIds.length > 0) {
        const { data: productosData } = await supabase
          .from('products_acopio')
          .select('id, name, description')
          .in('id', productoIds);
        (productosData || []).forEach(p => {
          productoMap.set(p.id, {
            id: p.id,
            name: p.name,
            description: p.description
          });
        });
      }

      // 4) Sucursales en lote
      const sucursalMap = new Map();
      if (sucursalIds.length > 0) {
        const { data: sucursalesData } = await supabase
          .from('branches')
          .select('id, name')
          .in('id', sucursalIds);
        (sucursalesData || []).forEach(s => {
          sucursalMap.set(s.id, {
            id: s.id,
            name: s.name
          });
        });
      }

      // Mapear todas las relaciones a los pedidos
      const pedidosConNombres = pedidosFiltrados.map((pedido) => {
        const user = pedido.user_id ? (userMap.get(pedido.user_id) || null) : null;
        const personal = pedido.personal_id ? (personalMap.get(pedido.personal_id) || null) : null;
        const producto_acopio = productoMap.get(pedido.producto_acopio_id) || null;
        const sucursal = sucursalMap.get(pedido.sucu_id) || null;
        return { ...pedido, user, personal, producto_acopio, sucursal };
      });

      let countQuery = supabase
        .from('pedidos_acopio')
        .select('*', { count: 'estimated', head: true })
        .eq('empresa_id', empresaId);

      if (estado && estado.trim() !== '') {
        countQuery = countQuery.eq('estado', estado);
      }

      if (normalizedResponsableId) {
        countQuery = countQuery.or(`user_id.eq.${normalizedResponsableId},personal_id.eq.${normalizedResponsableId}`);
      }

      // Aplicar filtro de fecha en el conteo también (incluyendo el día completo en zona horaria local)
      countQuery = aplicarFiltroFecha(countQuery, 'fecha', filtroFecha);

      const { count, error: countError } = await countQuery;

      if (countError) {
        throw new Error(`Error al contar pedidos: ${countError.message}`);
      }

      return {
        success: true,
        message: 'Pedidos obtenidos exitosamente',
        data: pedidosConNombres,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(((searchQuery ? pedidosConNombres.length : count) || 0) / limit),
          totalItems: searchQuery ? pedidosConNombres.length : count,
          hasNextPage: searchQuery ? false : page < Math.ceil(count / limit)
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
      
      // Si se proporciona un movimiento_entrada_id (incluso null), agregarlo
      if (movimientoEntradaId !== undefined) {
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

  // Entregar pedido (el controlador crea los gastos y pasa sus IDs en entregaData)
  static async entregar(pedidoId, entregaData) {
    try {
      if (!pedidoId) throw new Error('ID del pedido es requerido');
      if (!entregaData) throw new Error('Datos de entrega son requeridos');

      // Verificar que existe y no está ya entregado
      const { data: pedidoExistente, error: pedidoError } = await supabase
        .from('pedidos_acopio')
        .select('id, estado, producto_acopio_id')
        .eq('id', pedidoId)
        .single();

      if (pedidoError) {
        if (pedidoError.code === 'PGRST116') throw new Error('Pedido no encontrado');
        throw new Error(`Error al obtener el pedido: ${pedidoError.message}`);
      }

      if (pedidoExistente.estado === 'Entregado') {
        throw new Error('El pedido ya ha sido entregado');
      }

      const updateData = {
        estado: 'Entregado',
        fecha_entregado: entregaData.fecha_entregado,
        entregado_por: entregaData.entregado_por,
        cantidad_entregada: parseFloat(entregaData.cantidadEntregada),
        cantidad_entregada_ud: parseInt(entregaData.cantidadUD),
        cantidad_entregada_medida: entregaData.unidadUD || null,
        estado_entrega: entregaData.estado_entrega,
        observaciones_entrega: entregaData.observaciones || null,
        gasto_id: entregaData.gasto_id || null,
        gasto_otros_id: entregaData.gasto_otros_id || null
      };

      const { data: pedidoActualizado, error: updateError } = await supabase
        .from('pedidos_acopio')
        .update(updateData)
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
        throw new Error(`Error al actualizar el pedido: ${updateError.message}`);
      }

      return {
        success: true,
        message: 'Pedido entregado exitosamente',
        data: pedidoActualizado
      };

    } catch (error) {
      console.error('Error en pedidosAcopio.entregar:', error);
      return { success: false, message: error.message };
    }
  }

  // Obtener solicitantes únicos (solo IDs de user_id y personal_id)
  static async getSolicitantesUnicos(empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de la empresa es requerido');
      }

      // Obtener solo los IDs únicos de user_id y personal_id
      const { data: pedidos, error } = await supabase
        .from('pedidos_acopio')
        .select('user_id, personal_id')
        .eq('empresa_id', empresaId);

      if (error) {
        throw new Error(`Error al obtener solicitantes: ${error.message}`);
      }

      // Extraer IDs únicos
      const userIds = new Set();
      const personalIds = new Set();

      pedidos.forEach(pedido => {
        if (pedido.user_id) {
          userIds.add(pedido.user_id);
        }
        if (pedido.personal_id) {
          personalIds.add(pedido.personal_id);
        }
      });

      // Obtener nombres de usuarios y personal
      const solicitantes = [];

      // Obtener usuarios
      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', Array.from(userIds));

        if (usersData) {
          usersData.forEach(user => {
            solicitantes.push({
              id: user.id,
              name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Usuario desconocido',
              tipo: 'user',
              user_id: user.id,
              personal_id: null
            });
          });
        }
      }

      // Obtener personal
      if (personalIds.size > 0) {
        const { data: personalData } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .in('id', Array.from(personalIds));

        if (personalData) {
          personalData.forEach(personal => {
            solicitantes.push({
              id: personal.id,
              name: `${personal.first_name || ''} ${personal.last_name || ''}`.trim() || 'Personal desconocido',
              tipo: 'personal',
              user_id: null,
              personal_id: personal.id
            });
          });
        }
      }

      // Ordenar por nombre
      solicitantes.sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        message: 'Solicitantes obtenidos exitosamente',
        data: solicitantes
      };

    } catch (error) {
      console.error('Error en pedidosAcopio.getSolicitantesUnicos:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Anular entrega (el controlador elimina los gastos; este método solo limpia el pedido)
  static async anularEntrega(pedidoId) {
    try {
      if (!pedidoId) throw new Error('ID del pedido es requerido');

      // Obtener el pedido para validar estado y leer gasto_id / gasto_otros_id
      const { data: pedidoExistente, error: pedidoError } = await supabase
        .from('pedidos_acopio')
        .select('id, estado, gasto_id, gasto_otros_id')
        .eq('id', pedidoId)
        .single();

      if (pedidoError) {
        if (pedidoError.code === 'PGRST116') throw new Error('Pedido no encontrado');
        throw new Error(`Error al obtener el pedido: ${pedidoError.message}`);
      }

      if (pedidoExistente.estado !== 'Entregado') {
        throw new Error('Solo se pueden anular pedidos en estado Entregado');
      }

      if (!pedidoExistente.gasto_id) {
        throw new Error('El pedido no tiene un gasto asociado');
      }

      // Limpiar campos de entrega del pedido
      const { data: pedidoActualizado, error: updateError } = await supabase
        .from('pedidos_acopio')
        .update({
          estado: 'Pendiente',
          fecha_entregado: null,
          entregado_por: null,
          cantidad_entregada: null,
          cantidad_entregada_ud: null,
          cantidad_entregada_medida: null,
          estado_entrega: null,
          observaciones_entrega: null,
          movimiento_entrada_id: null,
          gasto_id: null,
          gasto_otros_id: null
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

      // Devolver los IDs de gastos para que el controlador los elimine
      return {
        success: true,
        message: 'Entrega anulada exitosamente',
        data: pedidoActualizado,
        gastosPendientesEliminar: {
          gasto_id: pedidoExistente.gasto_id,
          gasto_otros_id: pedidoExistente.gasto_otros_id
        }
      };

    } catch (error) {
      console.error('Error en pedidosAcopio.anularEntrega:', error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = pedidosAcopio;
