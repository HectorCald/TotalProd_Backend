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
        .select('*')
        .eq('empresa_id', empresaId)
        .order(orderBy, { ascending: ascending })
        .range(offset, offset + limit - 1);

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
          .from('sucursales')
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
  static async entregar(pedidoId, entregaData, userId, personalId = null) {
    try {
      if (!pedidoId) {
        throw new Error('ID del pedido es requerido');
      }

      if (!entregaData) {
        throw new Error('Datos de entrega son requeridos');
      }

      if (!userId && !personalId) {
        throw new Error('ID del usuario o personal es requerido');
      }

      // Obtener el pedido primero para validar que existe (optimizado - solo campos necesarios)
      const { data: pedidoExistente, error: pedidoError } = await supabase
        .from('pedidos_acopio')
        .select('id, estado, producto_acopio_id, cantidad, tipo_medida, sucu_id')
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

      // Crear el gasto primero (optimizado - obtener nombre del producto en lote)
      const gastosModel = require('./gastos');
      
      // Obtener nombre del producto para el concepto del gasto
      const { data: productoData, error: productoError } = await supabase
        .from('products_acopio')
        .select('name')
        .eq('id', pedidoExistente.producto_acopio_id)
        .single();
      
      if (productoError) {
        throw new Error(`Error al obtener producto: ${productoError.message}`);
      }
      
      const nombreProducto = productoData?.name || 'Producto';
      const concepto = `${nombreProducto} - ${entregaData.cantidadEntregada} ${entregaData.unidadEntregada}`;
      
      // Crear fecha en zona horaria de Bolivia (GMT-4) - CORREGIDO
      // Usar Intl.DateTimeFormat para obtener la fecha correcta sin problemas de zona horaria
      const ahora = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/La_Paz',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const partes = formatter.formatToParts(ahora);
      const año = partes.find(p => p.type === 'year').value;
      const mes = partes.find(p => p.type === 'month').value;
      const dia = partes.find(p => p.type === 'day').value;
      
      const fechaBolivia = `${año}-${mes}-${dia}`; // Formato YYYY-MM-DD

      const gastoData = {
        concepto: concepto,
        valor: entregaData.costo,
        metodo_pago: entregaData.metodo_pago,
        proveedor_id: entregaData.proveedor_id,
        observaciones: entregaData.observaciones || null,
        fecha_gasto: fechaBolivia // Usar fecha en zona horaria de Bolivia
      };

      // Determinar si usar user_id o personal_id basado en qué ID está disponible
      const gastoDataConUsuario = {
        ...gastoData,
        sucu_id: pedidoExistente.sucu_id  // Usar sucu_id ya obtenido
      };

      // Solo agregar user_id o personal_id si tienen valor
      if (personalId && personalId !== null) {
        gastoDataConUsuario.personal_id = personalId;
      } else if (userId && userId !== null) {
        gastoDataConUsuario.user_id = userId;
      }

      // Variables para almacenar IDs de gastos creados (para rollback si falla)
      let gastoIdCreado = null;
      let gastoOtrosIdCreado = null;

      try {
        const gastoResult = await gastosModel.create(gastoDataConUsuario);

        if (!gastoResult.success) {
          throw new Error(`Error al crear el gasto: ${gastoResult.message}`);
        }

        gastoIdCreado = gastoResult.data.id;
        console.log('Gasto creado:', gastoResult.data);
        console.log('Gasto ID:', gastoIdCreado);

        // Crear el segundo gasto de transporte/otros si existe
        let gastoOtrosResult = null;
        if (entregaData.transporte_otros !== undefined && entregaData.transporte_otros !== null && entregaData.transporte_otros !== '' && parseFloat(entregaData.transporte_otros) > 0) {
          const conceptoGastoOtros = `Transporte y/o otros (Compra '${nombreProducto}')`;
          
          const gastoOtrosData = {
            concepto: conceptoGastoOtros,
            valor: parseFloat(entregaData.transporte_otros),
            metodo_pago: entregaData.metodo_pago, // Usar el mismo método de pago
            proveedor_id: entregaData.proveedor_id, // Usar el mismo proveedor
            observaciones: entregaData.observaciones || null,
            fecha_gasto: fechaBolivia
          };

          const gastoOtrosDataConUsuario = {
            ...gastoOtrosData,
            sucu_id: pedidoExistente.sucu_id
          };

          // Solo agregar user_id o personal_id si tienen valor
          if (personalId && personalId !== null) {
            gastoOtrosDataConUsuario.personal_id = personalId;
          } else if (userId && userId !== null) {
            gastoOtrosDataConUsuario.user_id = userId;
          }

          gastoOtrosResult = await gastosModel.create(gastoOtrosDataConUsuario);

          if (!gastoOtrosResult.success) {
            throw new Error(`Error al crear el gasto de transporte/otros: ${gastoOtrosResult.message}`);
          }

          gastoOtrosIdCreado = gastoOtrosResult.data.id;
          console.log('Gasto transporte/otros creado:', gastoOtrosResult.data);
          console.log('Gasto transporte/otros ID:', gastoOtrosIdCreado);
        }

        // Actualizar el pedido con los datos de entrega (optimizado - sin embedded relations)
        // NOTA: entregado_por es un texto (nombre de la persona), NO un ID, por lo que no se hace JOIN
        const updateData = {
          estado: 'Entregado',
          fecha_entregado: entregaData.fecha_entregado,
          entregado_por: entregaData.entregado_por, // Nombre directo, no ID
          cantidad_entregada: parseFloat(entregaData.cantidadEntregada),
          cantidad_entregada_ud: parseInt(entregaData.cantidadUD),
          estado_entrega: entregaData.estado_entrega,
          observaciones_entrega: entregaData.observaciones || null,
          gasto_id: gastoIdCreado
        };

        // Solo agregar gasto_otros_id si tiene valor (el valor de transporte_otros ya está guardado en el gasto)
        if (gastoOtrosIdCreado) {
          updateData.gasto_otros_id = gastoOtrosIdCreado;
        }

        const { data: pedidoActualizado, error: updateError } = await supabase
          .from('pedidos_acopio')
          .update(updateData)
          .eq('id', pedidoId)
          .select('*')
          .single();

        if (updateError) {
          throw new Error(`Error al actualizar el pedido: ${updateError.message}`);
        }

        // Si llegamos aquí, todo fue exitoso - construir respuesta
        const responseData = {
          ...pedidoActualizado,
          producto_acopio: {
            id: pedidoExistente.producto_acopio_id,
            name: nombreProducto
          },
          gasto: {
            id: gastoIdCreado,
            concepto: gastoData.concepto,
            valor: gastoData.valor,
            metodo_pago: gastoData.metodo_pago,
            fecha_gasto: gastoData.fecha_gasto
          }
        };

        return {
          success: true,
          message: 'Pedido entregado exitosamente',
          data: responseData
        };

      } catch (error) {
        // ROLLBACK: Si algo falla después de crear los gastos, eliminarlos
        console.error('Error durante la entrega, realizando rollback de gastos...', error);
        
        if (gastoOtrosIdCreado) {
          try {
            console.log('Eliminando gasto transporte/otros creado:', gastoOtrosIdCreado);
            await gastosModel.delete(gastoOtrosIdCreado);
            console.log('Gasto transporte/otros eliminado correctamente');
          } catch (rollbackError) {
            console.error('Error al eliminar gasto transporte/otros durante rollback:', rollbackError);
          }
        }

        if (gastoIdCreado) {
          try {
            console.log('Eliminando gasto principal creado:', gastoIdCreado);
            await gastosModel.delete(gastoIdCreado);
            console.log('Gasto principal eliminado correctamente');
          } catch (rollbackError) {
            console.error('Error al eliminar gasto principal durante rollback:', rollbackError);
          }
        }

        // Re-lanzar el error original
        throw error;
      }

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
        .select('id, estado, gasto_id, gasto_otros_id')
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

      // Primero limpiar todos los campos de entrega del pedido (incluyendo gasto_id y gasto_otros_id)
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

      // Ahora eliminar los gastos (ya no hay referencia en el pedido)
      const gastosModel = require('./gastos');
      
      // Eliminar el gasto principal
      if (pedidoExistente.gasto_id) {
        const gastoResult = await gastosModel.delete(pedidoExistente.gasto_id);
        if (!gastoResult.success) {
          throw new Error(`Error al eliminar el gasto: ${gastoResult.message}`);
        }
        console.log('Gasto eliminado:', gastoResult.message);
      }

      // Eliminar el gasto de transporte/otros si existe
      if (pedidoExistente.gasto_otros_id) {
        const gastoOtrosResult = await gastosModel.delete(pedidoExistente.gasto_otros_id);
        if (!gastoOtrosResult.success) {
          throw new Error(`Error al eliminar el gasto de transporte/otros: ${gastoOtrosResult.message}`);
        }
        console.log('Gasto transporte/otros eliminado:', gastoOtrosResult.message);
      }

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