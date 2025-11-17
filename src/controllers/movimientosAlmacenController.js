const movimientosAlmacen = require('../models/movimientosAlmacen');
const transferenciasAlmacen = require('../models/transferenciasAlmacen');
const { checkDeletePermission, checkAnularPermission } = require('../utils/permissionsHelper');

class movimientosAlmacenController {
    // Crear un nuevo movimiento
    static async create(req, res) {
        
        try {
            const tValidationStart = Date.now();
            const { sucu_id, personal_id, type, observaciones, metodo_pago, cliente_id, proveedor_id, precio_id, productos, restar_ingredientes, produccion_damabrava_id, agrupado, gasto_id, descuento, aumento, fecha, numero_orden, concepto, ubicacion } = req.body;
            const user_id = req.user?.id;
            const userType = req.user?.type; // Verificar si es empleado o usuario normal

            // Si es empleado, usar personal_id, si es usuario normal, usar user_id
            const finalUserId = userType === 'employee' ? null : user_id;
            const finalPersonalId = userType === 'employee' ? personal_id : null;

            // Validar que se proporcione sucu_id
            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }
            
            // Validaciones básicas
            if (!type || !['entrada', 'salida'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'El tipo de movimiento es obligatorio y debe ser "entrada" o "salida"'
                });
            }

            if (!productos || !Array.isArray(productos) || productos.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe incluir al menos un producto en el movimiento'
                });
            }

            // Validar que los productos tengan los campos requeridos
            for (const producto of productos) {
                if (!producto.id) {
                    return res.status(400).json({
                        success: false,
                        message: 'Todos los productos deben tener un ID válido'
                    });
                }
                if (!producto.cantidad || producto.cantidad <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Todos los productos deben tener una cantidad válida mayor a 0'
                    });
                }
                if (producto.precio === undefined || producto.precio === null || producto.precio < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Todos los productos deben tener un precio válido mayor o igual a 0'
                    });
                }
            }

            // Validaciones específicas por tipo
            if (type === 'entrada' && proveedor_id && typeof proveedor_id !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del proveedor debe ser válido'
                });
            }

            if (type === 'salida' && cliente_id && typeof cliente_id !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del cliente debe ser válido'
                });
            }

            if (type === 'salida' && metodo_pago && !['qr', 'transferencia', 'tarjeta', 'efectivo','credito'].includes(metodo_pago)) {
                return res.status(400).json({
                    success: false,
                    message: 'El método de pago debe ser uno de: qr, transferencia, tarjeta, efectivo'
                });
            }

            // Si es un ingreso de producción y no se especifica precio_id, usar un precio por defecto
            let finalPrecioId = precio_id;
            if (!precio_id && produccion_damabrava_id) {
                // Para ingresos de producción, podemos usar null o buscar un precio por defecto
                // Por ahora usaremos null y el backend debe manejarlo
                finalPrecioId = null;
            }

            // Preparar datos del movimiento
            const movimientoData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                sucu_id,
                type,
                observaciones: observaciones || null,
                // Permitir metodo_pago también en entradas cuando se registra gasto
                metodo_pago: metodo_pago || null,
                cliente_id: type === 'salida' ? (cliente_id || null) : null,
                proveedor_id: type === 'entrada' ? (proveedor_id || null) : null,
                precio_id: finalPrecioId,
                productos,
                restar_ingredientes: restar_ingredientes || false,
                produccion_damabrava_id: produccion_damabrava_id || null,
                descuento: parseFloat(descuento) || 0,
                aumento: parseFloat(aumento) || 0,
                concepto: concepto && concepto.trim() !== '' ? concepto.trim() : null,
                ...(gasto_id ? { gasto_id } : {}),
                ...(typeof agrupado !== 'undefined' ? { agrupado: !!agrupado } : {}),
                ...(fecha ? { fecha } : {}),
                ...(numero_orden !== undefined ? { numero_orden } : {}),
                ...(ubicacion ? { ubicacion } : {})
            };

            // VALIDAR INGREDIENTES ANTES de crear el movimiento si es entrada con restar_ingredientes
            if (type === 'entrada' && restar_ingredientes) {
                try {
                    // Obtener productos con recetas en una sola query (bulk)
                    const productsAlmacen = require('../models/productsAlmacen');
                    const productIds = productos.map(p => p.id);
                    
                    // Query bulk para obtener todos los productos con sus recetas
                    const productosConRecetas = await productsAlmacen.getByIds(productIds, req.user?.empresa_id || null);
                    
                    // Procesar ingredientes para productos que tienen recetas
                    const ingredientesParaRestar = [];
                    
                    for (const productoData of productos) {
                        const producto = productosConRecetas.find(p => p.id === productoData.id);
                        
                        if (producto && producto.recetas && producto.recetas.length > 0) {
                            const receta = producto.recetas[0];
                            
                            if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                                // Agregar ingredientes a la lista para validación
                                ingredientesParaRestar.push({
                                    producto,
                                    cantidad: parseFloat(productoData.cantidad),
                                    ingredientes: receta.recetas_detalle
                                });
                            }
                        }
                    }
                    
                    // VALIDAR stock de ingredientes ANTES de crear el movimiento
                    if (ingredientesParaRestar.length > 0) {
                        const validacionIngredientes = await movimientosAlmacen.restarIngredientesBatch(
                            ingredientesParaRestar,
                            req.user.empresa_id
                        );
                        
                        // Si la validación falla, retornar error sin crear el movimiento
                        if (!validacionIngredientes.success) {
                            return res.status(400).json({
                                success: false,
                                message: validacionIngredientes.message,
                                ingredientesConStockInsuficiente: validacionIngredientes.ingredientesConStockInsuficiente
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error validando ingredientes:', error);
                    return res.status(400).json({
                        success: false,
                        message: 'Error al validar el stock de ingredientes: ' + error.message
                    });
                }
            }

            // Crear el movimiento (solo si la validación de ingredientes pasó)
            const result = await movimientosAlmacen.create(movimientoData);

            if (!result.success) {
                return res.status(400).json(result);
            }


            res.status(201).json({
                success: true,
                id: result.data.id
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.create:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener todos los movimientos de la sucursal
    static async getAll(req, res) {
        try {
            const sucu_id = req.query.sucu_id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 30;
            const tipo = req.query.tipo || null;
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const search = req.query.search || null;
            const cliente = req.query.cliente || null;
            
            // Extraer filtro de fecha
            let filtroFecha = null;
            if (req.query.fecha_inicio || req.query.fecha_fin) {
                filtroFecha = {
                    inicio: req.query.fecha_inicio || null,
                    fin: req.query.fecha_fin || null
                };
            }

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            // Para combinar y paginar correctamente, necesitamos obtener TODOS los datos de cada fuente
            // porque después de combinar y ordenar, necesitamos aplicar la paginación sobre el resultado combinado
            // Usamos un límite muy alto para obtener todos los registros
            const bufferLimit = 99999;
            
            // Obtener movimientos (solo si no hay filtro de tipo o si el tipo es 'entrada' o 'salida', pero NO 'transferencia')
            let resultMovimientos = { success: true, data: [], pagination: { total: 0, hasNextPage: false } };
            let totalMovimientos = 0;
            if (tipo !== 'transferencia') {
                // Obtener con buffer más grande para tener suficientes datos después de combinar
                resultMovimientos = await movimientosAlmacen.getAll(sucu_id, 1, bufferLimit, tipo, estado, ordenamiento, search, cliente, filtroFecha);

                if (!resultMovimientos.success) {
                    return res.status(400).json(resultMovimientos);
                }
                
                // Obtener el total real de movimientos para calcular hasNextPage correctamente
                totalMovimientos = resultMovimientos.pagination?.total || resultMovimientos.data?.length || 0;
            }

            // Obtener transferencias (solo si no hay filtro de tipo o si el tipo es 'transferencia')
            let transferencias = [];
            let totalTransferencias = 0;
            if (!tipo || tipo === 'transferencia') {
                const estadoTransferencia = estado === 'finalizado' ? 'Finalizado' : estado === 'anulado' ? 'Anulado' : null;
                const clienteIdTransferencia = cliente || null; // Usar el mismo filtro de cliente
                // Obtener con buffer más grande
                const resultTransferencias = await transferenciasAlmacen.getAll(sucu_id, 1, bufferLimit, estadoTransferencia, ordenamiento, search, filtroFecha, clienteIdTransferencia);
                
                if (resultTransferencias.success && resultTransferencias.data) {
                    // Obtener el total real de transferencias
                    totalTransferencias = resultTransferencias.pagination?.total || resultTransferencias.data?.length || 0;
                    
                    // Formatear transferencias como movimientos
                    transferencias = resultTransferencias.data.map(transferencia => ({
                        id: transferencia.id,
                        type: 'transferencia',
                        fecha: transferencia.fecha,
                        estado: transferencia.estado === 'Anulado' ? 'anulado' : 'finalizado',
                        concepto: transferencia.concepto || `Transferencia ${transferencia.sucursal_origen?.name || ''} → ${transferencia.sucursal_destino?.name || ''}`,
                        sucu_id: transferencia.sucu_origen_id,
                        sucu_origen_id: transferencia.sucu_origen_id,
                        sucu_destino_id: transferencia.sucu_destino_id,
                        sucursal: transferencia.sucursal_origen,
                        sucursal_origen: transferencia.sucursal_origen,
                        sucursal_destino: transferencia.sucursal_destino,
                        precio: transferencia.precio,
                        precio_id: transferencia.precio_id,
                        agrupado: transferencia.agrupado,
                        productos: transferencia.productos || [],
                        user: transferencia.user,
                        personal: transferencia.personal,
                        cliente: transferencia.cliente || null,
                        cliente_id: transferencia.cliente_id || null,
                        descuento: 0,
                        aumento: 0,
                        numero_orden: null,
                        metodo_pago: null,
                        proveedor: null
                    }));
                }
            }

            // Combinar movimientos y transferencias
            const allData = [...(resultMovimientos.data || []), ...transferencias];
            
            // Ordenar por fecha
            allData.sort((a, b) => {
                const fechaA = new Date(a.fecha);
                const fechaB = new Date(b.fecha);
                return ordenamiento === 'fecha_asc' ? fechaA - fechaB : fechaB - fechaA;
            });

            // Calcular el total real combinado
            // Si hay búsqueda, el total es la cantidad de items filtrados en memoria
            // Si no hay búsqueda, sumamos los totales de cada fuente
            const totalItemsCombinados = search 
                ? allData.length 
                : (totalMovimientos + totalTransferencias);

            // Aplicar paginación sobre el resultado combinado y ordenado
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedData = allData.slice(startIndex, endIndex);

            // Calcular hasNextPage correctamente
            // Si hay búsqueda, verificamos si hay más items en allData
            // Si no hay búsqueda, verificamos si hay más items en total combinado
            const hasNextPage = search 
                ? endIndex < allData.length 
                : endIndex < totalItemsCombinados;

            res.json({
                success: true,
                data: paginatedData,
                pagination: {
                    total: totalItemsCombinados,
                    page,
                    limit,
                    hasNextPage: hasNextPage
                }
            });


        } catch (error) {
            console.error('Error en movimientosAlmacenController.getAll:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener estadísticas optimizadas para gráficos
    static async getStatsForCharts(req, res) {
        try {
            const sucu_id = req.query.sucu_id;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            const result = await movimientosAlmacen.getStatsForCharts(sucu_id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.getStatsForCharts:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener movimientos por tipo
    static async getByType(req, res) {
        try {
            const sucu_id = req.query.sucu_id;
            const { tipo } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 30;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            if (!['entrada', 'salida'].includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'El tipo debe ser "entrada" o "salida"'
                });
            }

            const result = await movimientosAlmacen.getByType(sucu_id, tipo, page, limit);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.getByType:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener un movimiento por ID
    static async getById(req, res) {
        try {
            const { id } = req.params;
            const sucu_id = req.query.sucu_id;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            const result = await movimientosAlmacen.getById(id);

            if (!result.success) {
                return res.status(404).json(result);
            }

            // Verificar que el movimiento pertenece a la sucursal
            if (result.data.sucu_id !== sucu_id) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver este movimiento'
                });
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.getById:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Anular un movimiento
    static async anular(req, res) {
        
        try {
            const { id } = req.params;
            const { desdePedido, esEdicion } = req.body; // esEdicion indica si es una edición (omitir validación de permisos)
            const userType = req.user?.type;

            // Verificar permisos de anulación solo si es empleado Y NO es edición
            if (userType === 'employee' && !esEdicion) {
                const personal_id = req.user.id; // El personal_id viene del token

                const hasPermission = await checkAnularPermission(personal_id);
                
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para anular movimientos'
                    });
                }
            }

            const result = await movimientosAlmacen.anular(id, desdePedido);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }


            res.json({
                success: true,
                message: 'Movimiento anulado correctamente',
                data: result.data
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.anular:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Eliminar un movimiento
    static async eliminar(req, res) {
        try {
            const { id } = req.params;
            const { esEdicion } = req.body || {}; // esEdicion indica si es una edición (omitir validación de permisos)
            const userType = req.user?.type;

            // Verificar permisos de eliminación solo si es empleado Y NO es edición
            if (userType === 'employee' && !esEdicion) {
                const personal_id = req.user.id; // El personal_id viene del token

                const hasPermission = await checkDeletePermission(personal_id);
                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para eliminar movimientos'
                    });
                }
            }

            const result = await movimientosAlmacen.eliminar(id);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: 'Movimiento eliminado correctamente'
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.eliminar:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Verificar si un producto tiene movimientos (ULTRA OPTIMIZADO)
    static async hasMovements(req, res) {
        try {
            const { productId } = req.params;
            const sucu_id = req.query.sucu_id;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            if (!productId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del producto es requerido'
                });
            }

            const result = await movimientosAlmacen.hasMovements(productId, sucu_id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                hasMovements: result.hasMovements
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.hasMovements:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener movimientos por producto
    static async getByProduct(req, res) {
        try {
            const { productId } = req.params;
            const sucu_id = req.query.sucu_id;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            if (!productId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del producto es requerido'
                });
            }

            const result = await movimientosAlmacen.getByProduct(productId, sucu_id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.getByProduct:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener movimientos por cliente
    static async getByCliente(req, res) {
        try {
            const { clienteId } = req.params;
            const sucu_id = req.query.sucu_id;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            if (!clienteId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del cliente es requerido'
                });
            }

            const result = await movimientosAlmacen.getByCliente(clienteId, sucu_id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.getByCliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener movimientos por producción Damabrava
    static async getByProduccionDamabrava(req, res) {
        try {
            const { produccionId } = req.params;
            const sucu_id = req.query.sucu_id;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            if (!produccionId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la producción es requerido'
                });
            }

            const result = await movimientosAlmacen.getByProduccionDamabrava(produccionId, sucu_id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data
            });

        } catch (error) {
            console.error('Error en movimientosAlmacenController.getByProduccionDamabrava:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Actualizar un movimiento
    static async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del movimiento es requerido'
                });
            }

            const result = await movimientosAlmacen.update(id, updateData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Error en movimientosAlmacenController.update:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Eliminar productos de un movimiento
    static async deleteProductos(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del movimiento es requerido'
                });
            }

            const result = await movimientosAlmacen.deleteProductos(id);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Error en movimientosAlmacenController.deleteProductos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    // Crear productos de un movimiento
    static async createProductos(req, res) {
        try {
            const { id } = req.params;
            const { productos } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del movimiento es requerido'
                });
            }

            if (!productos || !Array.isArray(productos)) {
                return res.status(400).json({
                    success: false,
                    message: 'Productos son requeridos'
                });
            }

            const result = await movimientosAlmacen.createProductos(id, productos);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json(result);

        } catch (error) {
            console.error('Error en movimientosAlmacenController.createProductos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }
}

module.exports = movimientosAlmacenController;
