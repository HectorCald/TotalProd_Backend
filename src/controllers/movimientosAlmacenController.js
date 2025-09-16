const movimientosAlmacen = require('../models/movimientosAlmacen');

class movimientosAlmacenController {
    // Crear un nuevo movimiento
    static async create(req, res) {
        try {
            const { sucu_id, personal_id, tipo, observaciones, metodo_pago, cliente_id, proveedor_id, productos, restar_ingredientes } = req.body;
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
            if (!tipo || !['entrada', 'salida'].includes(tipo)) {
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
            if (tipo === 'entrada' && proveedor_id && typeof proveedor_id !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del proveedor debe ser válido'
                });
            }

            if (tipo === 'salida' && cliente_id && typeof cliente_id !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del cliente debe ser válido'
                });
            }

            if (tipo === 'salida' && metodo_pago && !['qr', 'transferencia', 'tarjeta', 'efectivo'].includes(metodo_pago)) {
                return res.status(400).json({
                    success: false,
                    message: 'El método de pago debe ser uno de: qr, transferencia, tarjeta, efectivo'
                });
            }

            // Preparar datos del movimiento
            const movimientoData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                sucu_id,
                tipo,
                observaciones: observaciones || null,
                metodo_pago: tipo === 'salida' ? (metodo_pago || null) : null,
                cliente_id: tipo === 'salida' ? (cliente_id || null) : null,
                proveedor_id: tipo === 'entrada' ? (proveedor_id || null) : null,
                productos
            };

            // Crear el movimiento
            const result = await movimientosAlmacen.create(movimientoData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            // Procesar ingredientes si es entrada y tiene restar_ingredientes activado
            if (tipo === 'entrada' && restar_ingredientes) {
                try {
                    // Obtener productos con recetas
                    const productsAlmacen = require('../models/productsAlmacen');
                    
                    for (const productoData of productos) {
                        // Obtener producto con recetas e ingredientes
                        const producto = await productsAlmacen.getById(productoData.id, req.user.empresa_id);
                        
                        if (producto && producto.recetas && producto.recetas.length > 0) {
                            const receta = producto.recetas[0];
                            
                            if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                                // Restar ingredientes del stock (SIN crear movimientos)
                                await movimientosAlmacen.restarIngredientes(
                                    producto, 
                                    parseFloat(productoData.cantidad), 
                                    receta.recetas_detalle,
                                    req.user.empresa_id
                                );
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error procesando ingredientes:', error);
                    // No fallar el movimiento principal si hay error con ingredientes
                }
            }


            res.status(201).json({
                success: true,
                message: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente`,
                data: result.data
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
            const limit = parseInt(req.query.limit) || 10;
            const tipo = req.query.tipo || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            const result = await movimientosAlmacen.getAll(sucu_id, page, limit, tipo, ordenamiento);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
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

    // Obtener movimientos por tipo
    static async getByType(req, res) {
        try {
            const sucu_id = req.query.sucu_id;
            const { tipo } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;

            if (!sucu_id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de la sucursal es requerido'
                });
            }

            if (!['entrada', 'salida'].includes(tipo)) {
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

            const result = await movimientosAlmacen.anular(id);

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
}

module.exports = movimientosAlmacenController;
