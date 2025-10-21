const registrosProduccionDamabrava = require('../models/registrosProduccionDamabrava');

class registrosProduccionDamabravaController {
    // Crear un nuevo registro de producción
    static async create(req, res) {
        try {
            const { 
                producto_almacen_id, 
                lote, 
                proceso, 
                microondas, 
                terminados, 
                vencimiento, 
                sucursal_id,
                observaciones 
            } = req.body;
            
            const user_id = req.user?.id;
            const userType = req.user?.type; // Verificar si es empleado o usuario normal

            // Si es empleado, usar personal_id, si es usuario normal, usar user_id
            const finalUserId = userType === 'employee' ? null : user_id;
            const finalPersonalId = userType === 'employee' ? user_id : null;

            // Validaciones básicas
            if (!producto_almacen_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del producto es obligatorio'
                });
            }

            if (!lote || isNaN(lote) || parseFloat(lote) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El lote debe ser un número válido mayor a 0'
                });
            }

            if (!proceso || !['cernido', 'seleccionado', 'ninguno'].includes(proceso)) {
                return res.status(400).json({
                    success: false,
                    message: 'El proceso debe ser uno de: cernido, seleccionado, ninguno'
                });
            }

            // Validar microondas solo si se proporciona un valor
            if (microondas !== undefined && microondas !== null && microondas !== '') {
                if (isNaN(microondas) || parseFloat(microondas) < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'La cantidad de microondas debe ser un número válido mayor o igual a 0'
                    });
                }
            }

            if (!terminados || isNaN(terminados) || parseFloat(terminados) < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La cantidad de terminados debe ser un número válido mayor o igual a 0'
                });
            }

            if (!vencimiento) {
                return res.status(400).json({
                    success: false,
                    message: 'La fecha de vencimiento es obligatoria'
                });
            }

            // Validar formato de fecha (YYYY-MM)
            const fechaRegex = /^\d{4}-\d{2}$/;
            if (!fechaRegex.test(vencimiento)) {
                return res.status(400).json({
                    success: false,
                    message: 'La fecha de vencimiento debe tener el formato YYYY-MM'
                });
            }

            // Validar que la fecha no sea anterior al mes actual
            const [año, mes] = vencimiento.split('-');
            const fechaSeleccionada = new Date(parseInt(año), parseInt(mes) - 1);
            const hoy = new Date();
            const mesActual = new Date(hoy.getFullYear(), hoy.getMonth());

            if (fechaSeleccionada < mesActual) {
                return res.status(400).json({
                    success: false,
                    message: 'La fecha de vencimiento no puede ser anterior al mes actual'
                });
            }

            if (!sucursal_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de la sucursal es obligatorio'
                });
            }

            // Preparar datos del registro
            const registroData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                producto_almacen_id,
                lote: parseFloat(lote),
                proceso,
                microondas: parseFloat(microondas) || 0,
                terminados: parseFloat(terminados),
                vencimiento: `${vencimiento}-01`, // Agregar día 1 para completar la fecha
                sucursal_id,
                observaciones: observaciones || null
            };

            // Crear el registro
            const result = await registrosProduccionDamabrava.create(registroData);

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.status(201).json({
                success: true,
                message: 'Registro de producción creado correctamente',
                data: result.data
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.create:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener registros de producción del usuario actual
    static async getByUser(req, res) {
        try {
            const userId = req.user?.id;
            const userType = req.user?.type;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const search = req.query.search || '';

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    message: 'Usuario no autenticado'
                });
            }

            const result = await registrosProduccionDamabrava.getByUser(
                userId,
                userType,
                page,
                limit,
                estado,
                ordenamiento,
                search
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.getByUser:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Obtener todos los registros de producción (sin filtrar por sucursal)
    static async getAll(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const search = req.query.search || '';
            const responsable_id = req.query.responsable_id || null;
            const responsable_tipo = req.query.responsable_tipo || null;

            const result = await registrosProduccionDamabrava.getAll(
                page, 
                limit, 
                estado, 
                ordenamiento, 
                search, 
                responsable_id, 
                responsable_tipo
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.getAll:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Eliminar un registro de producción
    static async delete(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del registro es requerido'
                });
            }

            const result = await registrosProduccionDamabrava.delete(id);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: 'Registro eliminado correctamente'
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.delete:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Verificar un registro de producción
    static async verify(req, res) {
        try {
            const { id } = req.params;
            const { cantidad_verificada, observaciones } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del registro es requerido'
                });
            }

            if (!cantidad_verificada || isNaN(cantidad_verificada) || parseFloat(cantidad_verificada) < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La cantidad verificada debe ser un número válido mayor o igual a 0'
                });
            }

            const verificacionData = {
                cantidad_verificada: parseFloat(cantidad_verificada),
                observaciones: observaciones || null
            };

            const result = await registrosProduccionDamabrava.verify(id, verificacionData);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: 'Registro verificado correctamente',
                data: result.data
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.verify:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Anular verificación de un registro de producción
    static async unverify(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del registro es requerido'
                });
            }

            const result = await registrosProduccionDamabrava.unverify(id);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: 'Verificación anulada correctamente',
                data: result.data
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.unverify:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Actualizar cantidad ingresada de un registro de producción
    static async updateCantidadIngresada(req, res) {
        try {
            const { id } = req.params;
            const { cantidad_ingresada } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del registro es requerido'
                });
            }

            if (!cantidad_ingresada || isNaN(cantidad_ingresada) || parseFloat(cantidad_ingresada) < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La cantidad ingresada debe ser un número válido mayor o igual a 0'
                });
            }

            const result = await registrosProduccionDamabrava.updateCantidadIngresada(id, parseFloat(cantidad_ingresada));

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: result.message,
                data: result.data
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.updateCantidadIngresada:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Restar cantidad ingresada cuando se anula un movimiento de producción
    static async restarCantidadIngresada(req, res) {
        try {
            const { id } = req.params;
            const { cantidad_a_restar } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del registro es requerido'
                });
            }

            if (!cantidad_a_restar || isNaN(cantidad_a_restar) || parseFloat(cantidad_a_restar) < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La cantidad a restar debe ser un número válido mayor o igual a 0'
                });
            }

            const result = await registrosProduccionDamabrava.restarCantidadIngresada(id, parseFloat(cantidad_a_restar));

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: result.message,
                data: result.data
            });

        } catch (error) {
            console.error('Error en registrosProduccionDamabravaController.restarCantidadIngresada:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
}

module.exports = registrosProduccionDamabravaController;
