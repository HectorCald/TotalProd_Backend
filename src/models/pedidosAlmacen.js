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

      if (!pedidoData.sucursal_destino_id) {
        throw new Error('ID de la sucursal de destino es requerido');
      }

      // Crear timestamp en zona horaria de Bolivia (GMT-4)
      const ahora = new Date();
      const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));

      // 1) PRIMERO: Incrementar total_pedidos de la sucursal y obtener el número
      const incrementResult = await this.incrementarTotalPedidosSucursal(sucuId);
      if (!incrementResult.success) {
        throw new Error(`Error al incrementar contador de pedidos: ${incrementResult.message}`);
      }

      // 2) SEGUNDO: Obtener el total_pedidos actualizado de la sucursal
      const { data: sucursalActualizada, error: sucursalError } = await supabase
        .from('sucursales')
        .select('total_pedidos')
        .eq('id', sucuId)
        .single();

      if (sucursalError) {
        throw new Error(`Error obteniendo total_pedidos actualizado: ${sucursalError.message}`);
      }

      const numeroPedido = sucursalActualizada?.total_pedidos || 0;

      // Crear el pedido principal
      const pedidoPrincipal = {
        empresa_id: empresaId,
        sucursal_id: sucuId,
        precio_id: pedidoData.precio_id,
        sucursal_destino_id: pedidoData.sucursal_destino_id,
        observaciones: pedidoData.observaciones || null,
        estado: 'Pendiente',
        fecha: ahoraBolivia.toISOString(), // Usar timestamp en zona horaria de Bolivia
        agrupado: !!pedidoData.agrupado,
        numero_pedido: numeroPedido
      };

      // Solo agregar user_id o personal_id si tienen valor
      // IMPORTANTE: No enviar campos null para evitar problemas de foreign key
      if (userId && userId !== null) {
        pedidoPrincipal.user_id = userId;
      }
      if (personalId && personalId !== null) {
        pedidoPrincipal.personal_id = personalId;
      }
      // Asignar cliente_id solo si viene definido
      if (typeof pedidoData.cliente_id !== 'undefined' && pedidoData.cliente_id !== null) {
        pedidoPrincipal.cliente_id = pedidoData.cliente_id;
      }

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .insert(pedidoPrincipal)
        .select('id')
        .single();

      if (pedidoError) {
        throw new Error(`Error al crear el pedido: ${pedidoError.message}`);
      }

      // Crear los detalles del pedido (INSERTs paralelos)
      const detalles = pedidoData.productos.map(producto => ({
        pedido_almacen_id: pedido.id,
        producto_almacen_id: producto.id,
        cantidad: producto.cantidad,
        precio: producto.precio || 0
      }));

      // INSERT en lote optimizado (mejor que paralelos para evitar saturación)
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

      // Obtener nombres de usuario y personal (CONSULTAS PARALELAS)
      let user = null;
      let personal = null;

      // Consultas paralelas para user y personal
      const consultasPromises = [];
      
      if (userId && userId !== null) {
        consultasPromises.push(
          supabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('id', userId)
            .single()
            .then(result => ({ tipo: 'user', data: result.data, error: result.error }))
        );
      } else {
        consultasPromises.push(Promise.resolve({ tipo: 'user', data: null, error: null }));
      }

      if (personalId && personalId !== null) {
        consultasPromises.push(
          supabase
            .from('personal')
            .select('id, first_name, last_name')
            .eq('id', personalId)
            .single()
            .then(result => ({ tipo: 'personal', data: result.data, error: result.error }))
        );
      } else {
        consultasPromises.push(Promise.resolve({ tipo: 'personal', data: null, error: null }));
      }

      // Ejecutar consultas en paralelo
      const resultadosNombres = await Promise.all(consultasPromises);
      
      // Procesar resultados
      resultadosNombres.forEach(resultado => {
        if (resultado.tipo === 'user' && resultado.data) {
          user = {
            id: resultado.data.id,
            name: `${resultado.data.first_name} ${resultado.data.last_name}`.trim()
          };
        } else if (resultado.tipo === 'personal' && resultado.data) {
          personal = {
            id: resultado.data.id,
            name: `${resultado.data.first_name} ${resultado.data.last_name}`.trim()
          };
        }
      });

      // Construir respuesta con datos básicos (sin consulta adicional)
      const pedidoConNombres = {
        id: pedido.id,
        empresa_id: empresaId,
        sucursal_id: sucuId,
        precio_id: pedidoData.precio_id,
        sucursal_destino_id: pedidoData.sucursal_destino_id,
        cliente_id: (typeof pedidoData.cliente_id !== 'undefined' ? pedidoData.cliente_id : null),
        observaciones: pedidoData.observaciones || null,
        estado: 'Pendiente',
        fecha: pedidoPrincipal.fecha,
        user_id: userId,
        personal_id: personalId,
        user,
        personal,
        pedido_almacen_detalle: detalles.map(detalle => ({
          ...detalle,
          producto_almacen: {
            id: pedidoData.productos.find(p => p.id === detalle.producto_almacen_id)?.id,
            name: pedidoData.productos.find(p => p.id === detalle.producto_almacen_id)?.name,
            description: pedidoData.productos.find(p => p.id === detalle.producto_almacen_id)?.description,
            grup: pedidoData.productos.find(p => p.id === detalle.producto_almacen_id)?.grup
          }
        }))
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
  static async getAll(sucuId, page = 1, limit = 10, searchQuery = null, estado = null, ordenamiento = 'fecha_desc') {
    try {
      
      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
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
        .from('pedidos_almacen')
        .select(`
          *,
          pedido_almacen_detalle (
            *,
            producto_almacen:producto_almacen_id (
              id,
              name,
              description,
              grup
            )
          ),
          sucursal:sucursal_id (
            id,
            name
          ),
          sucursal_destino:sucursal_destino_id (
            id,
            name
          ),
          cliente:cliente_id (
            id,
            name
          ),
          precio:prices_types (
            id,
            name
          )
        `)
        .or(`sucursal_id.eq.${sucuId},sucursal_destino_id.eq.${sucuId}`)
        .order(orderBy, { ascending: ascending })
        .range(offset, offset + limit - 1);

      // Si hay búsqueda, primero obtener IDs de productos por nombre, luego IDs de pedidos por detalle
      let pedidosIdsFiltrados = null;
      if (searchQuery && searchQuery.trim() !== '') {
        const term = `%${searchQuery}%`;
        // 1) Productos por nombre
        const { data: productosMatch, error: prodErr } = await supabase
          .from('products_almacen')
          .select('id, name')
          .ilike('name', term);
        if (!prodErr) {
          const productIds = (productosMatch || []).map(p => p.id);
          if (productIds.length > 0) {
            // 2) Detalle por producto
            const { data: detalleMatch, error: detErr } = await supabase
              .from('pedido_almacen_detalle')
              .select('pedido_almacen_id')
              .in('producto_almacen_id', productIds);
            if (!detErr) {
              pedidosIdsFiltrados = Array.from(new Set((detalleMatch || []).map(d => d.pedido_almacen_id)));
            }
          } else {
            pedidosIdsFiltrados = [];
          }
        }
      }

      // Aplicar filtro de estado si se proporciona
      if (estado && estado.trim() !== '') {
        query = query.eq('estado', estado);
      }

      // Si hay IDs encontrados, filtrar por esos IDs; si hay búsqueda y no hay IDs, devolver vacío
      if (Array.isArray(pedidosIdsFiltrados) && pedidosIdsFiltrados.length > 0) {
        query = query.in('id', pedidosIdsFiltrados);
      } else if (searchQuery && searchQuery.trim() !== '') {
        // Si hay búsqueda pero no se encontraron productos, devolver array vacío
        return {
          success: true,
          message: 'Pedidos obtenidos exitosamente',
          data: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            hasNextPage: false
          }
        };
      }

      const { data: pedidos, error } = await query;

      if (error) {
        throw new Error(`Error al obtener pedidos: ${error.message}`);
      }


      // Obtener nombres de usuarios y personal para cada pedido (BATCH LOADING)
      
      // Obtener IDs únicos de usuarios y personal
      const userIds = Array.from(new Set(pedidos.map(p => p.user_id).filter(Boolean)));
      const personalIds = Array.from(new Set(pedidos.map(p => p.personal_id).filter(Boolean)));

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
          .from('personal')
          .select('id, first_name, last_name')
          .in('id', personalIds);
        (personalData || []).forEach(p => {
          personalMap.set(p.id, {
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim()
          });
        });
      }

      // Obtener métodos de pago de movimientos de salida para pedidos entregados
      const movimientoSalidaIds = Array.from(new Set(
        pedidos
          .filter(p => p.estado === 'Entregado' && p.movimiento_salida_id)
          .map(p => p.movimiento_salida_id)
      ));
      
      const movimientoSalidaMap = new Map();
      if (movimientoSalidaIds.length > 0) {
        console.log('🔍 DEBUG - Obteniendo métodos de pago para movimientos:', movimientoSalidaIds);
        const { data: movimientosData } = await supabase
          .from('movimientos_almacen')
          .select('id, metodo_pago')
          .in('id', movimientoSalidaIds);
        
        (movimientosData || []).forEach(m => {
          movimientoSalidaMap.set(m.id, {
            id: m.id,
            metodo_pago: m.metodo_pago
          });
        });
        console.log('🔍 DEBUG - Movimientos obtenidos:', movimientosData);
      }

      // Mapear user/personal y movimiento_salida a los pedidos
      const pedidosConNombres = pedidos.map((pedido) => {
        const user = pedido.user_id ? (userMap.get(pedido.user_id) || null) : null;
        const personal = pedido.personal_id ? (personalMap.get(pedido.personal_id) || null) : null;
        const movimiento_salida = pedido.movimiento_salida_id ? (movimientoSalidaMap.get(pedido.movimiento_salida_id) || null) : null;
        return { ...pedido, user, personal, movimiento_salida };
      });
      
      // Obtener el total de pedidos para la paginación
      const { count, error: countError } = await supabase
        .from('pedidos_almacen')
        .select('*', { count: 'exact', head: true })
        .or(`sucursal_id.eq.${sucuId},sucursal_destino_id.eq.${sucuId}`);

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

  // Obtener todos los pedidos sin límite (para reportes)
  static async getAllSinLimite(sucuId) {
    try {
      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

      const { data: pedidos, error } = await supabase
        .from('pedidos_almacen')
        .select(`
          *,
          pedido_almacen_detalle (
            *,
            producto_almacen:producto_almacen_id (
              id,
              name,
              description,
              grup
            )
          ),
          sucursal:sucursal_id (
            id,
            name
          ),
          sucursal_destino:sucursal_destino_id (
            id,
            name
          ),
          cliente:cliente_id (
            id,
            name
          ),
          precio:prices_types (
            id,
            name
          )
        `)
        .or(`sucursal_id.eq.${sucuId},sucursal_destino_id.eq.${sucuId}`)
        .order('fecha', { ascending: false });

      if (error) {
        throw new Error(`Error al obtener pedidos: ${error.message}`);
      }

      // Obtener nombres de usuarios y personal para cada pedido (BATCH LOADING)
      const tNombresStart = Date.now();
      
      // Obtener IDs únicos de usuarios y personal
      const userIds = Array.from(new Set(pedidos.map(p => p.user_id).filter(Boolean)));
      const personalIds = Array.from(new Set(pedidos.map(p => p.personal_id).filter(Boolean)));

      // 1) Usuarios en lote
      let tUsersBatchMs = 0;
      const userMap = new Map();
      if (userIds.length > 0) {
        const tUsersStart = Date.now();
        const { data: usersData } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', userIds);
        tUsersBatchMs = Date.now() - tUsersStart;
        (usersData || []).forEach(u => {
          userMap.set(u.id, {
            id: u.id,
            name: `${u.first_name} ${u.last_name}`.trim()
          });
        });
      }

      // 2) Personal en lote
      let tPersonalBatchMs = 0;
      const personalMap = new Map();
      if (personalIds.length > 0) {
        const tPersonalStart = Date.now();
        const { data: personalData } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .in('id', personalIds);
        tPersonalBatchMs = Date.now() - tPersonalStart;
        (personalData || []).forEach(p => {
          personalMap.set(p.id, {
            id: p.id,
            name: `${p.first_name} ${p.last_name}`.trim()
          });
        });
      }

      // Mapear user/personal a los pedidos
      const pedidosConNombres = pedidos.map((pedido) => {
        const user = pedido.user_id ? (userMap.get(pedido.user_id) || null) : null;
        const personal = pedido.personal_id ? (personalMap.get(pedido.personal_id) || null) : null;
        return { ...pedido, user, personal };
      });
      
      const tNombresMs = Date.now() - tNombresStart;
      console.log('[PedidosAlmacenModel.getAllSinLimite] Obtener nombres ms=', tNombresMs, 'users batch ms=', tUsersBatchMs, 'personal batch ms=', tPersonalBatchMs);

      return {
        success: true,
        message: 'Pedidos obtenidos exitosamente',
        data: pedidosConNombres
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.getAllSinLimite:', error);
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
              description,
              grup
            )
          ),
          sucursal:sucursal_id (
            id,
            name
          ),
          sucursal_destino:sucursal_destino_id (
            id,
            name
          ),
          cliente:cliente_id (
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

      // Obtener método de pago del movimiento de salida si el pedido está entregado
      let movimiento_salida = null;
      if (pedido.estado === 'Entregado' && pedido.movimiento_salida_id) {
        const { data: movimientoData, error: movimientoError } = await supabase
          .from('movimientos_almacen')
          .select('id, metodo_pago')
          .eq('id', pedido.movimiento_salida_id)
          .single();
        
        if (movimientoData) {
          movimiento_salida = {
            id: movimientoData.id,
            metodo_pago: movimientoData.metodo_pago
          };
        }
      }

      const pedidoConNombres = {
        ...pedido,
        user,
        personal,
        movimiento_salida
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

      // Verificar que el pedido existe (OPTIMIZADO: solo si es necesario)
      // Comentado: la verificación se hace implícitamente en el UPDATE
      // Si el pedido no existe, el UPDATE no afectará ninguna fila

      // Actualizar el pedido principal (solo observaciones y precio_id, NO sucursal/empresa)
      const pedidoPrincipal = {
        observaciones: pedidoData.observaciones || null,
        precio_id: pedidoData.precio_id || null,
        agrupado: (typeof pedidoData.agrupado !== 'undefined') ? !!pedidoData.agrupado : undefined
      };

      const { data: updateResult, error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .update({
          ...pedidoPrincipal,
          // Permitir actualizar cliente_id si se manda en la petición (puede ser null para limpiar)
          ...(Object.prototype.hasOwnProperty.call(pedidoData, 'cliente_id') ? { cliente_id: pedidoData.cliente_id } : {})
        })
        .eq('id', pedidoId)
        .select('id');

      if (pedidoError) {
        throw new Error(`Error al actualizar el pedido: ${pedidoError.message}`);
      }

      // Verificar que el pedido existe (si no se actualizó ninguna fila)
      if (!updateResult || updateResult.length === 0) {
        throw new Error('Pedido no encontrado');
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
              description,
              grup
            )
          ),
          sucursal:sucursal_id (
            id,
            name
          ),
          sucursal_destino:sucursal_destino_id (
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

      // Obtener nombres de usuario y personal (OPTIMIZADO: consultas paralelas)
      let user = null;
      let personal = null;

      // Consultas paralelas para user y personal
      const consultasPromises = [];
      
      if (pedidoCompleto.user_id) {
        consultasPromises.push(
          supabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('id', pedidoCompleto.user_id)
            .single()
            .then(result => ({ tipo: 'user', data: result.data, error: result.error }))
        );
      } else {
        consultasPromises.push(Promise.resolve({ tipo: 'user', data: null, error: null }));
      }

      if (pedidoCompleto.personal_id) {
        consultasPromises.push(
          supabase
            .from('personal')
            .select('id, first_name, last_name')
            .eq('id', pedidoCompleto.personal_id)
            .single()
            .then(result => ({ tipo: 'personal', data: result.data, error: result.error }))
        );
      } else {
        consultasPromises.push(Promise.resolve({ tipo: 'personal', data: null, error: null }));
      }

      // Ejecutar consultas en paralelo
      const resultadosNombres = await Promise.all(consultasPromises);
      
      // Procesar resultados
      resultadosNombres.forEach(resultado => {
        if (resultado.tipo === 'user' && resultado.data) {
          user = {
            id: resultado.data.id,
            name: `${resultado.data.first_name} ${resultado.data.last_name}`.trim()
          };
        } else if (resultado.tipo === 'personal' && resultado.data) {
          personal = {
            id: resultado.data.id,
            name: `${resultado.data.first_name} ${resultado.data.last_name}`.trim()
          };
        }
      });

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

  // Actualizar entrega de pedido (solo precio, productos y cantidades) - DEPRECATED
  // Esta función ya no se usa, la lógica está en el controlador entregarPedido
  static async updateEntrega(pedidoId, pedidoData) {
    try {
      const tStart = Date.now();
      console.log('[PedidosAlmacenModel.updateEntrega] Iniciando actualización de entrega');
      
      if (!pedidoData.productos || !Array.isArray(pedidoData.productos) || pedidoData.productos.length === 0) {
        throw new Error('La lista de productos es requerida');
      }

      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!pedidoData.movimiento_id) {
        throw new Error('ID del movimiento es requerido');
      }

      // Verificar que el pedido existe (OPTIMIZADO: verificación implícita en UPDATE)

      // Actualizar precio_id, estado y movimiento_id del pedido principal
      const pedidoPrincipal = {
        precio_id: pedidoData.precio_id || null,
        estado: 'Entregado',
        movimiento_id: pedidoData.movimiento_id
      };

      const { data: updateResult, error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .update(pedidoPrincipal)
        .eq('id', pedidoId)
        .select('id');

      if (pedidoError) {
        throw new Error(`Error al actualizar el pedido: ${pedidoError.message}`);
      }

      // Verificar que el pedido existe (si no se actualizó ninguna fila)
      if (!updateResult || updateResult.length === 0) {
        throw new Error('Pedido no encontrado');
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
              description,
              grup
            )
          ),
          sucursal:sucursal_id (
            id,
            name
          ),
          sucursal_destino:sucursal_destino_id (
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

      // Obtener nombres de usuario y personal (OPTIMIZADO: consultas paralelas)
      let user = null;
      let personal = null;

      // Consultas paralelas para user y personal
      const consultasPromises = [];
      
      if (pedidoCompleto.user_id) {
        consultasPromises.push(
          supabase
            .from('users')
            .select('id, first_name, last_name')
            .eq('id', pedidoCompleto.user_id)
            .single()
            .then(result => ({ tipo: 'user', data: result.data, error: result.error }))
        );
      } else {
        consultasPromises.push(Promise.resolve({ tipo: 'user', data: null, error: null }));
      }

      if (pedidoCompleto.personal_id) {
        consultasPromises.push(
          supabase
            .from('personal')
            .select('id, first_name, last_name')
            .eq('id', pedidoCompleto.personal_id)
            .single()
            .then(result => ({ tipo: 'personal', data: result.data, error: result.error }))
        );
      } else {
        consultasPromises.push(Promise.resolve({ tipo: 'personal', data: null, error: null }));
      }

      // Ejecutar consultas en paralelo
      const resultadosNombres = await Promise.all(consultasPromises);
      
      // Procesar resultados
      resultadosNombres.forEach(resultado => {
        if (resultado.tipo === 'user' && resultado.data) {
          user = {
            id: resultado.data.id,
            name: `${resultado.data.first_name} ${resultado.data.last_name}`.trim()
          };
        } else if (resultado.tipo === 'personal' && resultado.data) {
          personal = {
            id: resultado.data.id,
            name: `${resultado.data.first_name} ${resultado.data.last_name}`.trim()
          };
        }
      });

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
  static async updateEstado(pedidoId, nuevoEstado, movimientoSalidaId = null, deudaId = null, movimientoEntradaId = null) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!nuevoEstado) {
        throw new Error('Nuevo estado es requerido');
      }

      // Obtener el pedido actual para verificar el estado anterior y la sucursal que hizo el pedido
      const { data: pedidoActual, error: pedidoError } = await supabase
        .from('pedidos_almacen')
        .select('estado, sucursal_id')
        .eq('id', pedidoId)
        .single();

      if (pedidoError) {
        if (pedidoError.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al obtener el pedido: ${pedidoError.message}`);
      }

      const estadoAnterior = pedidoActual.estado;
      const sucursalId = pedidoActual.sucursal_id;

      const updateData = { estado: nuevoEstado };
      
      // Si se proporciona un movimiento_salida_id, agregarlo
      if (movimientoSalidaId) {
        updateData.movimiento_salida_id = movimientoSalidaId;
      }
      
      // Si se proporciona un movimiento_entrada_id, agregarlo
      if (movimientoEntradaId) {
        updateData.movimiento_entrada_id = movimientoEntradaId;
      }
      
      // Si se proporciona un deuda_id, agregarlo
      if (deudaId) {
        updateData.deuda_id = deudaId;
      }
      
      // Si se pasa null explícitamente, limpiar los campos
      if (movimientoSalidaId === null) {
        updateData.movimiento_salida_id = null;
      }
      if (movimientoEntradaId === null) {
        updateData.movimiento_entrada_id = null;
      }
      if (deudaId === null) {
        updateData.deuda_id = null;
      }
      
      // Si el estado es 'Pendiente', limpiar movimiento_salida_id, movimiento_entrada_id y deuda_id
      if (nuevoEstado === 'Pendiente') {
        updateData.movimiento_salida_id = null;
        updateData.movimiento_entrada_id = null;
        updateData.deuda_id = null;
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

      // Actualizar contador de pedidos en la sucursal que hizo el pedido
      if (sucursalId) {
        // Si el estado cambió de no-Entregado a Entregado, incrementar contador en la sucursal que hizo el pedido
        if (estadoAnterior !== 'Entregado' && nuevoEstado === 'Entregado') {
          await this.incrementarTotalPedidosSucursal(sucursalId);
        }
        // Si el estado cambió de Entregado a no-Entregado, decrementar contador en la sucursal que hizo el pedido
        else if (estadoAnterior === 'Entregado' && nuevoEstado !== 'Entregado') {
          await this.decrementarTotalPedidosSucursal(sucursalId);
        }
      }

      // Obtener el pedido completo actualizado con la información de la sucursal
      const pedidoCompleto = await this.getById(pedidoId);
      
      return {
        success: true,
        message: 'Estado del pedido actualizado exitosamente',
        data: pedidoCompleto.success ? pedidoCompleto.data : data
      };

    } catch (error) {
      console.error('Error en pedidosAlmacen.updateEstado:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Incrementar el contador de pedidos en una sucursal
  static async incrementarTotalPedidosSucursal(sucursalId) {
    try {
      if (!sucursalId) {
        throw new Error('ID de la sucursal es requerido');
      }

      // Primero obtener el valor actual
      const { data: sucursal, error: fetchError } = await supabase
        .from('sucursales')
        .select('total_pedidos')
        .eq('id', sucursalId)
        .single();

      if (fetchError) {
        console.error('Error al obtener total_pedidos actual:', fetchError);
        return {
          success: false,
          message: `Error al obtener total_pedidos actual: ${fetchError.message}`
        };
      }

      // Incrementar el valor
      const nuevoTotal = (sucursal.total_pedidos || 0) + 1;

      const { error } = await supabase
        .from('sucursales')
        .update({ total_pedidos: nuevoTotal })
        .eq('id', sucursalId);

      if (error) {
        console.error('Error al incrementar total_pedidos:', error);
        return {
          success: false,
          message: `Error al incrementar total_pedidos: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Total de pedidos incrementado correctamente'
      };

    } catch (error) {
      console.error('Error en incrementarTotalPedidosSucursal:', error);
      return {
        success: false,
        message: `Error en incrementarTotalPedidosSucursal: ${error.message}`
      };
    }
  }

  // Decrementar el contador de pedidos en una sucursal
  static async decrementarTotalPedidosSucursal(sucursalId) {
    try {
      if (!sucursalId) {
        throw new Error('ID de la sucursal es requerido');
      }

      // Primero obtener el valor actual
      const { data: sucursal, error: fetchError } = await supabase
        .from('sucursales')
        .select('total_pedidos')
        .eq('id', sucursalId)
        .single();

      if (fetchError) {
        console.error('Error al obtener total_pedidos actual:', fetchError);
        return;
      }

      // Decrementar el valor (no puede ser menor a 0)
      const nuevoTotal = Math.max((sucursal.total_pedidos || 0) - 1, 0);

      const { error } = await supabase
        .from('sucursales')
        .update({ total_pedidos: nuevoTotal })
        .eq('id', sucursalId);

      if (error) {
        console.error('Error al decrementar total_pedidos:', error);
        // No lanzar error para no interrumpir el flujo principal
      }

    } catch (error) {
      console.error('Error en decrementarTotalPedidosSucursal:', error);
      // No lanzar error para no interrumpir el flujo principal
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

      // 1) PRIMERO: Obtener la sucursal_id del pedido antes de eliminarlo
      const { data: pedido, error: pedidoFetchError } = await supabase
        .from('pedidos_almacen')
        .select('sucursal_id')
        .eq('id', pedidoId)
        .single();

      if (pedidoFetchError) {
        if (pedidoFetchError.code === 'PGRST116') {
          throw new Error('Pedido no encontrado');
        }
        throw new Error(`Error al obtener el pedido: ${pedidoFetchError.message}`);
      }

      const sucursalId = pedido.sucursal_id;

      // 2) SEGUNDO: Eliminar los detalles del pedido
      const { error: detallesError } = await supabase
        .from('pedido_almacen_detalle')
        .delete()
        .eq('pedido_almacen_id', pedidoId);

      if (detallesError) {
        throw new Error(`Error al eliminar los detalles del pedido: ${detallesError.message}`);
      }

      // 3) TERCERO: Eliminar el pedido principal
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

      // 4) CUARTO: Decrementar total_pedidos de la sucursal
      if (sucursalId) {
        await this.decrementarTotalPedidosSucursal(sucursalId);
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
