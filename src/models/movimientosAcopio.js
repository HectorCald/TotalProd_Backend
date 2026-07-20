const { supabase } = require('../config/supabase');

// Función helper para normalizar texto (quitar acentos)
const normalizeText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .trim();
};

// Función para generar código aleatorio estructurado (3 letras y 3 números)
const generarCodigoAleatorioEstructurado = () => {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '0123456789';
    let codigo = '';
    for (let i = 0; i < 3; i++) {
        codigo += letras.charAt(Math.floor(Math.random() * letras.length));
    }
    for (let i = 0; i < 3; i++) {
        codigo += numeros.charAt(Math.floor(Math.random() * numeros.length));
    }
    return codigo;
};

// Función para generar código de movimiento
const generarCodigoMovimiento = (type) => {
    let prefijo = 'MAE';
    if (type === 'salida' || type === 'consumo_receta') {
        prefijo = 'MAS';
    }
    const codigoAleatorio = generarCodigoAleatorioEstructurado();
    return `${prefijo}-${codigoAleatorio}`;
};

class movimientosAcopio {
  // Crear un movimiento
  static async create(movimientoData, userId, personalId = null) {
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

      if (!userId && !personalId) {
        throw new Error('ID del usuario o personal es requerido');
      }


      if (!movimientoData.sucu_id) {
        throw new Error('ID de la sucursal es requerido');
      }

      // Crear timestamp en zona horaria de Bolivia (GMT-4) - CORREGIDO
      const ahora = new Date();
      const ahoraBolivia = ahora; // Usar directamente la hora local del sistema

      // Generar código único para el movimiento
      const codigoMovimiento = generarCodigoMovimiento(movimientoData.type);

      const dbData = {
        product_id: movimientoData.product_id,
        sucu_id: movimientoData.sucu_id,
        type: movimientoData.type,
        observations: movimientoData.observations || null,
        cliente_id: movimientoData.cliente_id || null,
        proveedor_id: null, // Forzado a null según indicación
        costo: null,        // Forzado a null según indicación
        metodo_pago: null,  // Forzado a null según indicación
        gasto_id: null,     // Forzado a null según indicación
        quantity: movimientoData.quantity,
        restar_ingredientes: movimientoData.restar_ingredientes || false,
        date: ahoraBolivia.toISOString(), // Usar timestamp en zona horaria de Bolivia
        codigo: codigoMovimiento,
        movimiento_entrada_id: movimientoData.movimiento_entrada_id || null
      };

      // Solo incluir user_id o personal_id si no son null
      if (userId && userId !== null) {
        dbData.user_id = userId;
      }
      if (personalId && personalId !== null) {
        dbData.personal_id = personalId;
      }


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
            name,
            total_orders
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
  static async getByProduct(productId, sucuId, limit = 10) {
    try {
      if (!productId) {
        throw new Error('ID del producto es requerido');
      }

      if (!sucuId) {
        throw new Error('ID de la sucursal es requerido');
      }

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
            name,
            total_orders
          ),
          cliente:cliente_id (
            id,
            name,
            total_orders
          )
        `)
        .eq('product_id', productId)
        .eq('sucu_id', sucuId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudo obtener los movimientos');
      }

      if (!movimientos || movimientos.length === 0) {
        return [];
      }

      const userIds = Array.from(new Set(movimientos.map(m => m.user_id).filter(Boolean)));
      const personalIds = Array.from(new Set(movimientos.map(m => m.personal_id).filter(Boolean)));

      const usersMap = new Map();
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', userIds);

        if (usersError) {
          console.warn('Error obteniendo usuarios para movimientos de acopio:', usersError);
        } else if (usersData) {
          usersData.forEach(user => {
            usersMap.set(user.id, {
              id: user.id,
              name: `${user.first_name || ''} ${user.last_name || ''}`.trim()
            });
          });
        }
      }

      const personalMap = new Map();
      if (personalIds.length > 0) {
        const { data: personalData, error: personalError } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .in('id', personalIds);

        if (personalError) {
          console.warn('Error obteniendo personal para movimientos de acopio:', personalError);
        } else if (personalData) {
          personalData.forEach(persona => {
            personalMap.set(persona.id, {
              id: persona.id,
              name: `${persona.first_name || ''} ${persona.last_name || ''}`.trim()
            });
          });
        }
      }

      const movimientoIds = movimientos.map(mov => mov.id);

      let pedidosMap = new Map();
      if (movimientoIds.length > 0) {
        const { data: pedidosRelacionados, error: pedidosError } = await supabase
          .from('pedidos_acopio')
          .select('movimiento_entrada_id')
          .in('movimiento_entrada_id', movimientoIds);

        if (pedidosError) {
          console.warn('Error obteniendo pedidos de acopio relacionados:', pedidosError);
        } else if (pedidosRelacionados) {
          pedidosMap = pedidosRelacionados.reduce((map, pedido) => {
            if (pedido.movimiento_entrada_id) {
              map.set(pedido.movimiento_entrada_id, true);
            }
            return map;
          }, new Map());
        }
      }

      const movimientosFormateados = movimientos.map(movimiento => {
        const user = movimiento.user_id ? (usersMap.get(movimiento.user_id) || null) : null;
        const personal = movimiento.personal_id ? (personalMap.get(movimiento.personal_id) || null) : null;

        return {
          ...movimiento,
          user,
          personal,
          tiene_pedido_relacionado: pedidosMap.get(movimiento.id) || false
        };
      });

      return movimientosFormateados;
    } catch (error) {
      console.error('Error al obtener movimientos por producto:', error);
      throw error;
    }
  }

  // Método estático para obtener un movimiento por ID
  static async getById(movimientoId) {
    try {
      if (!movimientoId) {
        throw new Error('ID del movimiento es requerido');
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
            name,
            total_orders
          ),
          cliente:cliente_id (
            id,
            name,
            total_orders
          ),
          sucursal:sucu_id (
            id,
            name
          ),
          gastos:gastos!gastos_movimiento_acopio_entrada_id_fkey (
            id
          ),
          pedidos_entrada:pedidos_acopio (
            id
          )
        `)
        .eq('id', movimientoId)
        .single();

      if (error) {
        console.error('Error en Supabase query:', error);
        if (error.code === 'PGRST116') {
          throw new Error('Movimiento no encontrado');
        }
        throw new Error(`No se pudo obtener el movimiento: ${error.message}`);
      }

      if (!data) {
        throw new Error('Movimiento no encontrado');
      }

      // Obtener información del usuario o personal
      let user = null;
      let personal = null;

      // Si tiene user_id, obtener el usuario
      if (data.user_id) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .eq('id', data.user_id)
          .single();
        
        if (!userError && userData) {
          user = {
            id: userData.id,
            name: `${userData.first_name} ${userData.last_name}`.trim()
          };
        }
      }

      // Si tiene personal_id, obtener el personal
      if (data.personal_id) {
        const { data: personalData, error: personalError } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .eq('id', data.personal_id)
          .single();
        
        if (!personalError && personalData) {
          personal = {
            id: personalData.id,
            name: `${personalData.first_name} ${personalData.last_name}`.trim()
          };
        }
      }

      // Agregar la información del usuario/personal al movimiento
      const movimientoCompleto = {
        ...data,
        user,
        personal
      };

      return movimientoCompleto;
    } catch (error) {
      console.error('Error al obtener movimiento por ID:', error);
      throw error;
    }
  }

  // Obtener todos los movimientos
  static async getAll(sucuId, page = 1, limit = 10, tipo = null, estado = null, ordenamiento = 'fecha_desc', search = null, clienteId = null, filtroFecha = null) {
    try {
      const tStart = Date.now();
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
          ),
          sucursal:sucu_id (
            id,
            name
          ),
          gastos:gastos!gastos_movimiento_acopio_entrada_id_fkey (
            id
          ),
          pedidos_entrada:pedidos_acopio (
            id
          )
        `, { count: 'estimated' })
        .eq('sucu_id', sucuId);

      // Aplicar filtro de tipo si se especifica
      if (tipo) {
        query = query.eq('type', tipo);
      }

      // Aplicar filtro de estado si se proporciona
      if (estado) {
        query = query.eq('estado', estado);
      }

      if (clienteId) {
        const clienteFilter = String(clienteId).toLowerCase();
        query = query.eq('cliente_id', clienteFilter);
      }

      // Aplicar filtro de fecha si se proporciona (incluyendo el día completo en UTC)
      if (filtroFecha) {
        if (filtroFecha.inicio) {
          query = query.gte('date', `${filtroFecha.inicio}T00:00:00.000Z`);
        }
        if (filtroFecha.fin) {
          query = query.lte('date', `${filtroFecha.fin}T23:59:59.999Z`);
        }
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
        console.error('SUPABASE ERROR in movimientosAcopio.getAll:', error);
        throw new Error('No se pudo obtener los movimientos');
      }

      // Hidratación: resolver usuarios/personal en lote para evitar N+1 y evitar embeds (RLS sensibles)
      const tHydrateStart = Date.now();
      const userIds = Array.from(new Set((data || []).map(m => m.user_id).filter(Boolean)));
      const personalIds = Array.from(new Set((data || []).map(m => m.personal_id).filter(Boolean)));

      const usersMap = new Map();
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name, last_name')
          .in('id', userIds);
        if (!usersError && usersData) {
          usersData.forEach(u => {
            usersMap.set(u.id, { id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() });
          });
        }
      }

      const personalMap = new Map();
      if (personalIds.length > 0) {
        const { data: persData, error: persError } = await supabase
          .from('personal')
          .select('id, first_name, last_name')
          .in('id', personalIds);
        if (!persError && persData) {
          persData.forEach(p => {
            personalMap.set(p.id, { id: p.id, name: `${p.first_name || ''} ${p.last_name || ''}`.trim() });
          });
        }
      }

      let dataFiltrada = data || [];
      if (search && search.trim() !== '') {
        const normalizedSearchTerm = normalizeText(search);
        dataFiltrada = dataFiltrada.filter(m => {
          const productName = normalizeText(m.product?.name || '');
          return productName.includes(normalizedSearchTerm);
        });
      }

      const movimientosConNombres = (dataFiltrada || []).map(mov => ({
        ...mov,
        user: mov.user_id ? (usersMap.get(mov.user_id) || null) : null,
        personal: mov.personal_id ? (personalMap.get(mov.personal_id) || null) : null
      }));
      const tHydrateMs = Date.now() - tHydrateStart;
      const tTotalMs = Date.now() - tStart;

      const result = {
        success: true,
        message: 'Movimientos obtenidos exitosamente',
        data: movimientosConNombres,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(((search ? movimientosConNombres.length : count) || 0) / limit),
          totalItems: search ? movimientosConNombres.length : count,
          hasNextPage: search ? false : page < Math.ceil(count / limit)
        }
      };
      return result;
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
        `, { count: 'estimated' })
        .eq('cliente_id', normalizedClienteId)
        .eq('sucu_id', sucuId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Error al obtener movimientos: ${error.message}`);
      }

      const { count, error: countError } = await supabase
        .from('movimientos_acopio')
        .select('*', { count: 'estimated', head: true })
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
        `, { count: 'estimated' })
        .eq('proveedor_id', normalizedProveedorId)
        .eq('sucu_id', sucuId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Error al obtener movimientos: ${error.message}`);
      }

      const { count, error: countError } = await supabase
        .from('movimientos_acopio')
        .select('*', { count: 'estimated', head: true })
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

  // Método para validar stock de ingredientes sin restar (solo validación)
  static async validarStockIngredientes(cantidadEntrada, ingredientes, cantidadesPersonalizadas = null) {
    try {
      // Preparar datos de ingredientes válidos
      const ingredientesValidos = ingredientes.filter(ingrediente => 
        ingrediente.products_acopio && ingrediente.products_acopio.id
      );

      if (ingredientesValidos.length === 0) {
        return { success: true, message: 'No hay ingredientes válidos para procesar' };
      }

      // Obtener IDs de ingredientes para consulta bulk
      const ingredienteIds = ingredientesValidos.map(ingrediente => ingrediente.products_acopio.id);

      // Consulta bulk para obtener stocks actuales
      const { data: productosActuales, error: fetchError } = await supabase
        .from('products_acopio')
        .select('id, quantity')
        .in('id', ingredienteIds);

      if (fetchError) {
        console.error('Error obteniendo stocks de ingredientes:', fetchError);
        throw new Error('Error al obtener stocks de ingredientes');
      }

      // Crear mapa de stocks actuales para acceso rápido
      const stocksActuales = {};
      productosActuales.forEach(producto => {
        stocksActuales[producto.id] = producto.quantity;
      });

      // Validar stock sin restar
      const ingredientesConStockInsuficiente = [];

      for (let i = 0; i < ingredientesValidos.length; i++) {
        const ingrediente = ingredientesValidos[i];
        
        // Usar cantidad personalizada si existe, sino usar la calculada
        let cantidadARestar;
        if (cantidadesPersonalizadas && cantidadesPersonalizadas[i] !== undefined) {
          cantidadARestar = parseFloat(cantidadesPersonalizadas[i]);
        } else {
          cantidadARestar = ingrediente.cantidad * cantidadEntrada;
        }
        
        const cantidadActual = stocksActuales[ingrediente.products_acopio.id] || 0;
        const nuevaCantidad = cantidadActual - cantidadARestar;
        
        // Verificar stock suficiente
        if (nuevaCantidad < 0) {
          ingredientesConStockInsuficiente.push({
            nombre: ingrediente.products_acopio.name,
            stockActual: cantidadActual,
            requerido: cantidadARestar
          });
        }
      }

      // Si hay ingredientes con stock insuficiente, retornar error
      if (ingredientesConStockInsuficiente.length > 0) {
        const mensajeError = ingredientesConStockInsuficiente.map(ing => 
          `${ing.nombre}: Stock actual ${ing.stockActual}, requerido ${ing.requerido}`
        ).join('; ');
        
        return { 
          success: false, 
          message: `Stock insuficiente de ingredientes: ${mensajeError}`,
          ingredientesConStockInsuficiente: ingredientesConStockInsuficiente
        };
      }

      return { 
        success: true, 
        message: 'Stock de ingredientes suficiente'
      };
    } catch (error) {
      console.error('Error en validarStockIngredientes:', error);
      throw new Error('Error al validar stock de ingredientes');
    }
  }

  // Método para restar ingredientes del stock cuando se hace una entrada con receta
  static async restarIngredientes(productoPrincipal, cantidadEntrada, ingredientes, empresaId, cantidadesPersonalizadas = null, sucuId = null, userId = null, personalId = null, movimientoEntradaId = null) {
    try {
      // Preparar datos de ingredientes válidos
      const ingredientesValidos = ingredientes.filter(ingrediente => 
        ingrediente.products_acopio && ingrediente.products_acopio.id
      );

      if (ingredientesValidos.length === 0) {
        return { success: true, message: 'No hay ingredientes válidos para procesar' };
      }

      // Obtener IDs de ingredientes para consulta bulk
      const ingredienteIds = ingredientesValidos.map(ingrediente => ingrediente.products_acopio.id);

      // Consulta bulk para obtener stocks actuales
      const { data: productosActuales, error: fetchError } = await supabase
        .from('products_acopio')
        .select('id, quantity')
        .in('id', ingredienteIds);

      if (fetchError) {
        console.error('Error obteniendo stocks de ingredientes:', fetchError);
        throw new Error('Error al obtener stocks de ingredientes');
      }

      // Crear mapa de stocks actuales para acceso rápido
      const stocksActuales = {};
      productosActuales.forEach(producto => {
        stocksActuales[producto.id] = producto.quantity;
      });

      // Preparar actualizaciones batch
      const actualizaciones = [];
      const ingredientesConStockInsuficiente = [];

      for (let i = 0; i < ingredientesValidos.length; i++) {
        const ingrediente = ingredientesValidos[i];
        
        // Usar cantidad personalizada si existe, sino usar la calculada
        let cantidadARestar;
        if (cantidadesPersonalizadas && cantidadesPersonalizadas[i] !== undefined) {
          cantidadARestar = parseFloat(cantidadesPersonalizadas[i]);
        } else {
          cantidadARestar = ingrediente.cantidad * cantidadEntrada;
        }
        
        const cantidadActual = stocksActuales[ingrediente.products_acopio.id] || 0;
        const nuevaCantidad = cantidadActual - cantidadARestar;
        
        // Verificar stock suficiente
        if (nuevaCantidad < 0) {
          ingredientesConStockInsuficiente.push({
            nombre: ingrediente.products_acopio.name,
            stockActual: cantidadActual,
            requerido: cantidadARestar
          });
          continue;
        }

        actualizaciones.push({
          id: ingrediente.products_acopio.id,
          quantity: nuevaCantidad
        });
      }

      // Si hay ingredientes con stock insuficiente, retornar error
      if (ingredientesConStockInsuficiente.length > 0) {
        console.warn('Ingredientes con stock insuficiente:', ingredientesConStockInsuficiente);
        
        // Crear mensaje detallado de error
        const mensajeError = ingredientesConStockInsuficiente.map(ing => 
          `${ing.nombre}: Stock actual ${ing.stockActual}, requerido ${ing.requerido}`
        ).join('; ');
        
        return { 
          success: false, 
          message: `Stock insuficiente de ingredientes: ${mensajeError}`,
          ingredientesConStockInsuficiente: ingredientesConStockInsuficiente
        };
      }

      // Crear movimientos de salida para cada ingrediente
      let actualizadosCount = 0;
      for (let i = 0; i < ingredientesValidos.length; i++) {
        const ingrediente = ingredientesValidos[i];
        
        // Usar cantidad personalizada si existe, sino usar la calculada
        let cantidadARestar;
        if (cantidadesPersonalizadas && cantidadesPersonalizadas[i] !== undefined) {
          cantidadARestar = parseFloat(cantidadesPersonalizadas[i]);
        } else {
          cantidadARestar = ingrediente.cantidad * cantidadEntrada;
        }

        // Solo crear movimiento si la cantidad es mayor a 0
        if (cantidadARestar > 0) {
          const movimientoSalida = {
            product_id: ingrediente.products_acopio.id,
            sucu_id: sucuId,
            type: 'salida',
            observations: `Consumo por receta de ${productoPrincipal.name}`,
            quantity: cantidadARestar,
            movimiento_entrada_id: movimientoEntradaId || null
          };

          // Pasar por el flujo normal de salida usando create()
          // create() se encarga de restar el stock de products_acopio y crear el movimiento
          await this.create(movimientoSalida, userId, personalId);
          actualizadosCount++;
        }
      }

      return { 
        success: true, 
        message: 'Ingredientes restados correctamente',
        actualizados: actualizadosCount,
        conStockInsuficiente: ingredientesConStockInsuficiente.length
      };
    } catch (error) {
      console.error('Error en restarIngredientes:', error);
      throw new Error('Error al restar ingredientes del stock');
    }
  }

  // Anular un movimiento
  static async anular(movimientoId) {
    try {
      // Obtener el movimiento básico primero (OPTIMIZADO)
      const { data: movimiento, error: movimientoError } = await supabase
        .from('movimientos_acopio')
        .select('id, type, quantity, estado, gasto_id, restar_ingredientes, product_id')
        .eq('id', movimientoId)
        .maybeSingle();

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

      // Si restar_ingredientes es true, anular y eliminar los movimientos hijos primero
      if (movimiento.restar_ingredientes) {
        // Buscar movimientos hijos
        const { data: movimientosHijos, error: errorHijos } = await supabase
          .from('movimientos_acopio')
          .select('id')
          .eq('movimiento_entrada_id', movimientoId);
          
        if (errorHijos) {
          console.error('Error buscando movimientos hijos:', errorHijos);
          return { success: false, message: 'Error al buscar los consumos de receta asociados' };
        }

        if (movimientosHijos && movimientosHijos.length > 0) {
          for (const hijo of movimientosHijos) {
            // Anular el hijo usando el mismo método (para reponer stock)
            const anularHijoResult = await this.anular(hijo.id);
            if (!anularHijoResult.success) {
              console.error(`Error anulando movimiento hijo ${hijo.id}:`, anularHijoResult.message);
              return { success: false, message: `Error al anular un consumo de receta: ${anularHijoResult.message}` };
            }
            
            // Eliminar el movimiento hijo de la base de datos
            const { error: deleteHijoError } = await supabase
              .from('movimientos_acopio')
              .delete()
              .eq('id', hijo.id);
              
            if (deleteHijoError) {
              console.error(`Error eliminando movimiento hijo ${hijo.id}:`, deleteHijoError);
              return { success: false, message: 'Error al eliminar un consumo de receta asociado' };
            }
          }
          console.log(`Anulados y eliminados ${movimientosHijos.length} consumos de receta asociados.`);
        }
      }

      // Verificar relación con pedidos de acopio: si está relacionado, actualizar el pedido
      const { data: pedidosAcopioRelacionados } = await supabase
        .from('pedidos_acopio')
        .select('id, estado')
        .eq('movimiento_entrada_id', movimientoId)
        .limit(1)
        .maybeSingle();

      // Si está relacionado con un pedido de acopio, actualizar el pedido
      if (pedidosAcopioRelacionados) {
        // Cambiar estado del pedido de "Completado" a "Entregado" y limpiar movimiento_entrada_id
        const { error: updatePedidoError } = await supabase
          .from('pedidos_acopio')
          .update({ 
            estado: 'Entregado',
            movimiento_entrada_id: null
          })
          .eq('id', pedidosAcopioRelacionados.id);

        if (updatePedidoError) {
          console.error('Error actualizando pedido de acopio:', updatePedidoError);
          return { success: false, message: 'Error al actualizar el pedido relacionado' };
        }
        
        console.log('Pedido de acopio actualizado al anular movimiento:', pedidosAcopioRelacionados.id);
      }

      // Verificar relación con pedidos de almacén: si está relacionado, no permitir anular
      const { data: pedidosAlmacenRelacionados } = await supabase
        .from('pedidos_almacen')
        .select('id')
        .or(`movimiento_salida_id.eq.${movimientoId},movimiento_entrada_id.eq.${movimientoId}`)
        .limit(1)
        .maybeSingle();

      if (pedidosAlmacenRelacionados) {
        return { success: false, message: 'No se puede anular: el movimiento está relacionado con un pedido de almacén' };
      }

      // Si tiene gasto_id, eliminar el gasto asociado primero
      if (movimiento.gasto_id) {
        const { error: deleteGastoError } = await supabase
          .from('gastos')
          .delete()
          .eq('id', movimiento.gasto_id);

        if (deleteGastoError) {
          console.error('Error eliminando gasto asociado:', deleteGastoError);
          return { success: false, message: 'Error al eliminar el gasto asociado' };
        }
        console.log('Gasto eliminado al anular entrada:', movimiento.gasto_id);
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

      // Obtener producto actual para calcular nueva cantidad
      const { data: producto, error: productoError } = await supabase
        .from('products_acopio')
        .select('quantity')
        .eq('id', movimiento.product_id)
        .maybeSingle();

      if (productoError || !producto) {
        console.error('Error obteniendo producto:', productoError);
        return { success: false, message: 'Error al obtener el producto' };
      }

      // Revertir el stock del producto principal
      const cantidadMovimiento = parseFloat(movimiento.quantity);
      let nuevaCantidad;

      if (movimiento.type === 'entrada') {
        // Anular entrada = restar del stock
        nuevaCantidad = producto.quantity - cantidadMovimiento;
      } else {
        // Anular salida = sumar al stock
        nuevaCantidad = producto.quantity + cantidadMovimiento;
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

      // Si es entrada con restar_ingredientes, buscar y procesar salidas relacionadas
      if (movimiento.type === 'entrada' && movimiento.restar_ingredientes) {
        // Buscar todas las salidas relacionadas con este movimiento de entrada
        const { data: salidasRelacionadas, error: salidasError } = await supabase
          .from('movimientos_acopio')
          .select('id, product_id, quantity, estado')
          .eq('movimiento_entrada_id', movimientoId)
          .eq('type', 'salida');

        if (salidasError) {
          console.error('Error buscando salidas relacionadas:', salidasError);
          // Continuar con la anulación aunque haya error buscando salidas
        } else if (salidasRelacionadas && salidasRelacionadas.length > 0) {
          // Guardar IDs de salidas eliminadas para retornarlos (todos los IDs, sin importar si falla)
          const salidasEliminadasIds = salidasRelacionadas.map(s => s.id);
          
          // Obtener todos los productos únicos de las salidas en una sola consulta
          const productIds = [...new Set(salidasRelacionadas.map(s => s.product_id))];
          const { data: productosSalidas, error: productosError } = await supabase
            .from('products_acopio')
            .select('id, quantity')
            .in('id', productIds);

          if (!productosError && productosSalidas) {
            // Crear mapa de productos para acceso rápido
            const productosMap = {};
            productosSalidas.forEach(p => {
              productosMap[p.id] = p.quantity;
            });

            // Calcular nuevas cantidades para cada producto (puede haber múltiples salidas del mismo producto)
            const actualizacionesStock = {};
            salidasRelacionadas.forEach(salida => {
              const cantidadSalida = parseFloat(salida.quantity);
              const cantidadActual = productosMap[salida.product_id] || 0;
              
              if (!actualizacionesStock[salida.product_id]) {
                actualizacionesStock[salida.product_id] = cantidadActual;
              }
              actualizacionesStock[salida.product_id] += cantidadSalida;
            });

            // Actualizar stocks en batch (paralelo)
            const updatePromises = Object.entries(actualizacionesStock).map(([productId, nuevaCantidad]) =>
              supabase
                .from('products_acopio')
                .update({ quantity: nuevaCantidad })
                .eq('id', productId)
            );

            await Promise.all(updatePromises);
          }

          // Anular todas las salidas que no estén ya anuladas en batch
          const salidasParaAnular = salidasRelacionadas.filter(s => s.estado !== 'anulado');
          if (salidasParaAnular.length > 0) {
            const salidasIdsParaAnular = salidasParaAnular.map(s => s.id);
            await supabase
              .from('movimientos_acopio')
              .update({ estado: 'anulado' })
              .in('id', salidasIdsParaAnular);
          }

          // Eliminar todas las salidas directamente (sin llamar al método eliminar que es lento)
          await supabase
            .from('movimientos_acopio')
            .delete()
            .in('id', salidasEliminadasIds);

          console.log(`Procesadas ${salidasRelacionadas.length} salidas relacionadas al anular entrada ${movimientoId}`);
          
          // Retornar los IDs de las salidas eliminadas
          return { 
            success: true, 
            message: pedidosAcopioRelacionados 
              ? 'Movimiento anulado correctamente. El pedido relacionado ha sido actualizado a estado "Entregado"'
              : 'Movimiento anulado correctamente',
            data: { ...movimiento, estado: 'anulado' },
            pedidoActualizado: pedidosAcopioRelacionados ? {
              id: pedidosAcopioRelacionados.id,
              estadoAnterior: pedidosAcopioRelacionados.estado,
              estadoNuevo: 'Entregado'
            } : null,
            salidasEliminadas: salidasEliminadasIds
          };
        }
        // NO devolver ingredientes aquí porque ya se devolvieron al procesar las salidas
      }

      return { 
        success: true, 
        message: pedidosAcopioRelacionados 
          ? 'Movimiento anulado correctamente. El pedido relacionado ha sido actualizado a estado "Entregado"'
          : 'Movimiento anulado correctamente',
        data: { ...movimiento, estado: 'anulado' },
        pedidoActualizado: pedidosAcopioRelacionados ? {
          id: pedidosAcopioRelacionados.id,
          estadoAnterior: pedidosAcopioRelacionados.estado,
          estadoNuevo: 'Entregado'
        } : null,
        salidasEliminadas: [] // Array vacío si no hay salidas relacionadas
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
