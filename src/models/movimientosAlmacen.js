const { supabase } = require('../config/supabase');

class movimientosAlmacen {
    // Crear un nuevo movimiento de almacén
    static async create(movimientoData) {
        try {
            const { user_id, personal_id, sucu_id, tipo, observaciones, metodo_pago, cliente_id, proveedor_id, precio_id, productos } = movimientoData;

            // Iniciar transacción
            const insertData = {
                sucu_id,
                tipo,
                observaciones,
                metodo_pago,
                precio_id,
                cliente_id: cliente_id || null,
                proveedor_id: proveedor_id || null
            };

            // Solo agregar user_id o personal_id si tienen valor
            // IMPORTANTE: No enviar campos null para evitar problemas de foreign key
            if (user_id && user_id !== null) {
                insertData.user_id = user_id;
            }
            if (personal_id && personal_id !== null) {
                insertData.personal_id = personal_id;
            }

            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .insert(insertData)
                .select()
                .single();

            if (movimientoError) {
                console.error('Error creando movimiento:', movimientoError);
                return { success: false, message: 'Error al crear el movimiento', error: movimientoError };
            }

            // Crear los detalles de productos si existen
            if (productos && productos.length > 0) {
                const productosData = productos.map(producto => ({
                    movimiento_almacen_id: movimiento.id,
                    producto_almacen_id: producto.id,
                    cantidad: producto.cantidad,
                    precio_unitario: producto.precio || 0,
                    subtotal: (producto.precio || 0) * producto.cantidad
                }));

                const { error: productosError } = await supabase
                    .from('movimiento_almacen_producto')
                    .insert(productosData);

                if (productosError) {
                    console.error('Error creando detalles de productos:', productosError);
                    // Si falla, eliminar el movimiento principal
                    await supabase
                        .from('movimientos_almacen')
                        .delete()
                        .eq('id', movimiento.id);
                    
                    return { success: false, message: 'Error al crear los detalles de productos', error: productosError };
                }

                // Actualizar stock de productos después de crear el movimiento
                for (const producto of productos) {
                    // Obtener el stock actual del producto en la sucursal específica
                    const { data: stockActual, error: errorStock } = await supabase
                        .from('productos_sucursal')
                        .select('id, stock')
                        .eq('producto_id', producto.id)
                        .eq('sucursal_id', sucu_id)
                        .single();

                    if (errorStock && errorStock.code !== 'PGRST116') {
                        console.error(`Error al obtener el stock del producto ${producto.id}:`, errorStock);
                        // Si falla, eliminar el movimiento y sus productos
                        await supabase
                            .from('movimiento_almacen_producto')
                            .delete()
                            .eq('movimiento_almacen_id', movimiento.id);
                        
                        await supabase
                            .from('movimientos_almacen')
                            .delete()
                            .eq('id', movimiento.id);
                        
                        return { success: false, message: 'Error al obtener el stock del producto', error: errorStock };
                    }

                    // Si no existe registro de stock para esta sucursal, crear uno
                    let stockActualValue = 0;
                    let stockId = null;
                    
                    if (stockActual) {
                        stockActualValue = stockActual.stock || 0;
                        stockId = stockActual.id;
                    }

                    let nuevaCantidad;
                    if (tipo === 'entrada') {
                        nuevaCantidad = stockActualValue + producto.cantidad;
                    } else if (tipo === 'salida') {
                        nuevaCantidad = stockActualValue - producto.cantidad;
                        
                        // Verificar que hay suficiente stock
                        if (nuevaCantidad < 0) {
                            console.error(`Stock insuficiente para producto ${producto.id}. Stock actual: ${stockActualValue}, Cantidad requerida: ${producto.cantidad}`);
                            // Si falla, eliminar el movimiento y sus productos
                            await supabase
                                .from('movimiento_almacen_producto')
                                .delete()
                                .eq('movimiento_almacen_id', movimiento.id);
                            
                            await supabase
                                .from('movimientos_almacen')
                                .delete()
                                .eq('id', movimiento.id);
                            
                            return { success: false, message: 'Stock insuficiente', error: 'Stock insuficiente' };
                        }
                    }

                    // Actualizar o crear el stock en la sucursal
                    if (stockId) {
                        // Actualizar stock existente
                        const { error: updateError } = await supabase
                            .from('productos_sucursal')
                            .update({ stock: nuevaCantidad })
                            .eq('id', stockId);

                        if (updateError) {
                            console.error(`Error actualizando stock para producto ${producto.id}:`, updateError);
                            // Si falla, eliminar el movimiento y sus productos
                            await supabase
                                .from('movimiento_almacen_producto')
                                .delete()
                                .eq('movimiento_almacen_id', movimiento.id);
                            
                            await supabase
                                .from('movimientos_almacen')
                                .delete()
                                .eq('id', movimiento.id);
                            
                            return { success: false, message: 'Error al actualizar stock', error: updateError };
                        }
                    } else {
                        // Crear nuevo registro de stock
                        const { error: createError } = await supabase
                            .from('productos_sucursal')
                            .insert([{
                                producto_id: producto.id,
                                sucursal_id: sucu_id,
                                stock: nuevaCantidad
                            }]);

                        if (createError) {
                            console.error(`Error creando stock para producto ${producto.id}:`, createError);
                            // Si falla, eliminar el movimiento y sus productos
                            await supabase
                                .from('movimiento_almacen_producto')
                                .delete()
                                .eq('movimiento_almacen_id', movimiento.id);
                            
                            await supabase
                                .from('movimientos_almacen')
                                .delete()
                                .eq('id', movimiento.id);
                            
                            return { success: false, message: 'Error al crear stock', error: createError };
                        }
                    }
                }
            }

            // Obtener el movimiento completo con detalles y stock actualizado
            const movimientoCompleto = await this.getById(movimiento.id);
            
            // Actualizar el stock de los productos en la respuesta con el stock actual de la sucursal
            if (movimientoCompleto.data && movimientoCompleto.data.productos) {
                for (const productoMovimiento of movimientoCompleto.data.productos) {
                    // Obtener el stock actual del producto en la sucursal
                    const { data: stockActual } = await supabase
                        .from('productos_sucursal')
                        .select('stock')
                        .eq('producto_id', productoMovimiento.producto.id)
                        .eq('sucursal_id', sucu_id)
                        .single();
                    
                    // Actualizar el stock en el producto
                    if (stockActual) {
                        productoMovimiento.producto.stock = stockActual.stock;
                    } else {
                        productoMovimiento.producto.stock = 0;
                    }
                }
            }
            
            return { success: true, data: movimientoCompleto.data };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.create:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener movimiento por ID con detalles
    static async getById(id) {
        try {
            const { data: movimiento, error: movimientoError } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:proveedores(id, name),
                    precio:prices_types(id, name)
                `)
                .eq('id', id)
                .single();

            if (movimientoError) {
                return { success: false, message: 'Movimiento no encontrado', error: movimientoError };
            }

            // Obtener productos del movimiento
            const { data: productos, error: productosError } = await supabase
                .from('movimiento_almacen_producto')
                .select(`
                    *,
                    producto:producto_almacen_id(
                        id, 
                        name, 
                        description
                    )
                `)
                .eq('movimiento_almacen_id', id);

            if (productosError) {
                console.error('Error obteniendo productos del movimiento:', productosError);
            }

            // Obtener el stock actualizado de cada producto en la sucursal del movimiento
            const productosConStock = await Promise.all(
                (productos || []).map(async (productoMovimiento) => {
                    const { data: stockActual } = await supabase
                        .from('productos_sucursal')
                        .select('stock')
                        .eq('producto_id', productoMovimiento.producto.id)
                        .eq('sucursal_id', movimiento.sucu_id)
                        .single();
                    
                    return {
                        ...productoMovimiento,
                        producto: {
                            ...productoMovimiento.producto,
                            stock: stockActual ? stockActual.stock : 0
                        }
                    };
                })
            );

            return {
                success: true,
                data: {
                    ...movimiento,
                    productos: productosConStock
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getById:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener todos los movimientos de una sucursal
    static async getAll(sucuId, page = 1, limit = 10, tipo = null, ordenamiento = 'fecha_desc') {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:proveedores(id, name),
                    precio:prices_types(id, name)
                `, { count: 'exact' })
                .eq('sucu_id', sucuId);

            // Aplicar filtro de tipo si se proporciona
            if (tipo) {
                query = query.eq('tipo', tipo);
            }

            // Aplicar ordenamiento
            const ascending = ordenamiento === 'fecha_asc';
            query = query.order('fecha', { ascending });

            const { data: movimientos, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                return { success: false, message: 'Error al obtener movimientos', error };
            }

            // Obtener productos y información de usuario para cada movimiento
            const movimientosConProductos = await Promise.all(
                movimientos.map(async (movimiento) => {
                    // Obtener productos del movimiento
                    const { data: productos } = await supabase
                        .from('movimiento_almacen_producto')
                        .select(`
                            *,
                            producto:producto_almacen_id(
                                id, 
                                name, 
                                description
                            )
                        `)
                        .eq('movimiento_almacen_id', movimiento.id);

                    // Obtener información del usuario
                    let user = null;
                    let personal = null;

                    // Si tiene user_id, obtener el usuario
                    if (movimiento.user_id) {
                        const { data: userData, error: userError } = await supabase
                            .from('users')
                            .select('id, first_name, last_name')
                            .eq('id', movimiento.user_id)
                            .single();
                        
                        if (!userError && userData) {
                            user = {
                                id: userData.id,
                                name: `${userData.first_name} ${userData.last_name}`.trim()
                            };
                        }
                    }

                    // Si tiene personal_id, obtener el personal
                    if (movimiento.personal_id) {
                        const { data: personalData, error: personalError } = await supabase
                            .from('personal')
                            .select('id, first_name, last_name')
                            .eq('id', movimiento.personal_id)
                            .single();
                        
                        if (!personalError && personalData) {
                            personal = {
                                id: personalData.id,
                                name: `${personalData.first_name} ${personalData.last_name}`.trim()
                            };
                        }
                    }

                    return {
                        ...movimiento,
                        productos: productos || [],
                        user,
                        personal
                    };
                })
            );

            return {
                success: true,
                data: movimientosConProductos,
                pagination: {
                    total: count,
                    page,
                    limit,
                    hasNextPage: count > offset + limit
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getAll:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener movimientos por tipo (entrada/salida)
    static async getByType(sucuId, tipo, page = 1, limit = 10) {
        try {
            const offset = (page - 1) * limit;

            const { data: movimientos, error, count } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:proveedores(id, name),
                    precio:prices_types(id, name)
                `, { count: 'exact' })
                .eq('sucu_id', sucuId)
                .eq('tipo', tipo)
                .order('fecha', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                return { success: false, message: 'Error al obtener movimientos', error };
            }

            // Obtener productos para cada movimiento
            const movimientosConProductos = await Promise.all(
                movimientos.map(async (movimiento) => {
                    const { data: productos } = await supabase
                        .from('movimiento_almacen_producto')
                        .select(`
                            *,
                            producto:producto_almacen_id(
                                id, 
                                name, 
                                description
                            )
                        `)
                        .eq('movimiento_almacen_id', movimiento.id);

                    return {
                        ...movimiento,
                        productos: productos || []
                    };
                })
            );

            return {
                success: true,
                data: movimientosConProductos,
                pagination: {
                    total: count,
                    page,
                    limit,
                    hasNextPage: count > offset + limit
                }
            };

        } catch (error) {
            console.error('Error en MovimientosAlmacen.getByType:', error);
            return { success: false, message: 'Error interno del servidor', error };
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
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:proveedores(id, name),
                    precio:prices_types(id, name),
                    productos:movimiento_almacen_producto (
                        id,
                        cantidad,
                        precio_unitario,
                        subtotal,
                        producto:producto_almacen_id (
                            id,
                            name,
                            recetas (
                                id,
                                descripcion,
                                recetas_detalle (
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
                .from('movimientos_almacen')
                .update({ estado: 'anulado' })
                .eq('id', movimientoId);

            if (updateError) {
                console.error('Error actualizando estado:', updateError);
                return { success: false, message: 'Error al anular el movimiento' };
            }

            // Revertir el stock de cada producto en la sucursal específica
            for (const productoMovimiento of movimiento.productos) {
                const cantidadMovimiento = parseFloat(productoMovimiento.cantidad);
                
                // Obtener el stock actual del producto en la sucursal
                const { data: stockActual, error: errorStock } = await supabase
                    .from('productos_sucursal')
                    .select('id, stock')
                    .eq('producto_id', productoMovimiento.producto.id)
                    .eq('sucursal_id', movimiento.sucu_id)
                    .single();

                if (errorStock && errorStock.code !== 'PGRST116') {
                    console.error(`Error al obtener el stock del producto ${productoMovimiento.producto.name}:`, errorStock);
                    // Revertir el estado del movimiento
                    await supabase
                        .from('movimientos_almacen')
                        .update({ estado: 'activo' })
                        .eq('id', movimientoId);
                    return { success: false, message: 'Error al obtener el stock del producto' };
                }

                const stockActualValue = stockActual ? stockActual.stock : 0;
                let nuevaCantidad;

                if (movimiento.tipo === 'entrada') {
                    // Anular entrada = restar del stock
                    nuevaCantidad = stockActualValue - cantidadMovimiento;
                } else {
                    // Anular salida = sumar al stock
                    nuevaCantidad = stockActualValue + cantidadMovimiento;
                }

                // Actualizar stock del producto en la sucursal
                if (stockActual) {
                    // Actualizar stock existente
                    const { error: stockError } = await supabase
                        .from('productos_sucursal')
                        .update({ stock: nuevaCantidad })
                        .eq('id', stockActual.id);

                    if (stockError) {
                        console.error(`Error actualizando stock del producto ${productoMovimiento.producto.name}:`, stockError);
                        // Revertir el estado del movimiento
                        await supabase
                            .from('movimientos_almacen')
                            .update({ estado: 'activo' })
                            .eq('id', movimientoId);
                        return { success: false, message: 'Error al actualizar el stock' };
                    }
                } else {
                    // Crear nuevo registro de stock si no existe
                    const { error: createError } = await supabase
                        .from('productos_sucursal')
                        .insert([{
                            producto_id: productoMovimiento.producto.id,
                            sucursal_id: movimiento.sucu_id,
                            stock: nuevaCantidad
                        }]);

                    if (createError) {
                        console.error(`Error creando stock del producto ${productoMovimiento.producto.name}:`, createError);
                        // Revertir el estado del movimiento
                        await supabase
                            .from('movimientos_almacen')
                            .update({ estado: 'activo' })
                            .eq('id', movimientoId);
                        return { success: false, message: 'Error al crear el stock' };
                    }
                }

                // Si es entrada y tiene receta, devolver ingredientes consumidos
                if (movimiento.tipo === 'entrada' && productoMovimiento.producto.recetas && productoMovimiento.producto.recetas.length > 0) {
                    const receta = productoMovimiento.producto.recetas[0];
                    
                    if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                        // Devolver ingredientes (sumar al stock)
                        for (const ingrediente of receta.recetas_detalle) {
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
                .from('movimientos_almacen')
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

            // Eliminar primero los productos relacionados
            const { error: productosError } = await supabase
                .from('movimiento_almacen_producto')
                .delete()
                .eq('movimiento_almacen_id', movimientoId);

            if (productosError) {
                console.error('Error eliminando productos del movimiento:', productosError);
                return { success: false, message: 'Error al eliminar los productos del movimiento' };
            }

            // Eliminar el movimiento principal
            const { error: deleteError } = await supabase
                .from('movimientos_almacen')
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

    // Obtener movimientos por producto
    static async getByProduct(productId, sucuId) {
        try {
            if (!productId) {
                throw new Error('ID del producto es requerido');
            }

            if (!sucuId) {
                throw new Error('ID de la sucursal es requerido');
            }

            // Obtener movimientos que contengan el producto específico
            const { data: movimientos, error } = await supabase
                .from('movimientos_almacen')
                .select(`
                    *,
                    cliente:clients(id, name),
                    proveedor:proveedores(id, name),
                    precio:prices_types(id, name)
                `)
                .eq('sucu_id', sucuId)
                .order('fecha', { ascending: false });

            if (error) {
                console.error('Error obteniendo movimientos:', error);
                return { success: false, message: 'Error al obtener movimientos', error };
            }

            // Filtrar movimientos que contengan el producto específico
            const movimientosConProducto = [];
            
            for (const movimiento of movimientos) {
                const { data: productos } = await supabase
                    .from('movimiento_almacen_producto')
                    .select(`
                        *,
                        producto:producto_almacen_id(
                            id, 
                            name, 
                            description
                        )
                    `)
                    .eq('movimiento_almacen_id', movimiento.id)
                    .eq('producto_almacen_id', productId);

                if (productos && productos.length > 0) {
                    // Obtener el stock actualizado del producto en la sucursal
                    const { data: stockActual } = await supabase
                        .from('productos_sucursal')
                        .select('stock')
                        .eq('producto_id', productId)
                        .eq('sucursal_id', sucuId)
                        .single();

                    const productosConStock = productos.map(productoMovimiento => ({
                        ...productoMovimiento,
                        producto: {
                            ...productoMovimiento.producto,
                            stock: stockActual ? stockActual.stock : 0
                        }
                    }));

                    movimientosConProducto.push({
                        ...movimiento,
                        productos: productosConStock
                    });
                }
            }

            return {
                success: true,
                data: movimientosConProducto
            };

        } catch (error) {
            console.error('Error en getByProduct:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }
}

module.exports = movimientosAlmacen;
