const registrosProduccionDamabrava = require('../models/registrosProduccionDamabrava');

class registrosProduccionDamabravaController {

    static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
        const {
            requireAuth = true,
            validateSucuId = false,
            validateRegistroId = false,
            successStatus = 200,
            errorStatus = 400
        } = options;

        try {
            if (requireAuth) {
                const userId = req.user?.id;
                if (!userId) {
                    return res.status(401).json({
                        success: false,
                        message: 'Usuario no autenticado'
                    });
                }
            }

            if (validateSucuId) {
                const sucuId = req.query.sucu_id || req.body.sucu_id || req.body.sucursal_id || req.user?.sucu_id;
                if (!sucuId) {
                    return res.status(400).json({
                        success: false,
                        message: 'El ID de la sucursal es obligatorio'
                    });
                }
                if (req.query) req.query.sucu_id = sucuId;
                if (req.body) {
                    req.body.sucu_id = sucuId;
                    req.body.sucursal_id = sucuId;
                }
            }

            if (validateRegistroId) {
                const { id } = req.params;
                if (!id) {
                    return res.status(400).json({
                        success: false,
                        message: 'ID es requerido'
                    });
                }
            }

            const result = await handlerFn();

            if (!result.success) {
                const finalErrorStatus = result.status || errorStatus;
                return res.status(finalErrorStatus).json(result);
            }

            return res.status(successStatus).json(result);
        } catch (error) {
            console.error(`Error en registrosProduccionDamabravaController.${actionName}:`, error);
            return res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }

    // Crear un nuevo registro de producción
    static async create(req, res) {
        const { 
            producto_almacen_id, 
            lote, 
            proceso, 
            microondas, 
            terminados, 
            vencimiento, 
            observaciones 
        } = req.body;

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

        const fechaRegex = /^\d{4}-\d{2}$/;
        if (!fechaRegex.test(vencimiento)) {
            return res.status(400).json({
                success: false,
                message: 'La fecha de vencimiento debe tener el formato YYYY-MM'
            });
        }

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

        return registrosProduccionDamabravaController._handleRequest(res, 'create', req, async () => {
            const user_id = req.user?.id;
            const userType = req.user?.type;

            const finalUserId = userType === 'employee' ? null : user_id;
            const finalPersonalId = userType === 'employee' ? user_id : null;

            let empresaId = req.user?.empresa_id;
            const finalSucuId = req.body.sucursal_id;
            
            if (!empresaId && finalSucuId) {
                try {
                    const sucursales = require('../models/sucursales');
                    const sucursalResponse = await sucursales.getById(finalSucuId);
                    if (sucursalResponse && sucursalResponse.success && sucursalResponse.data) {
                        const sucursal = sucursalResponse.data;
                        if (sucursal.empresa_id) {
                            empresaId = sucursal.empresa_id;
                        } else if (sucursal.empresas && sucursal.empresas.id) {
                            empresaId = sucursal.empresas.id;
                        }
                    }
                } catch (error) {
                    console.error('Error obteniendo empresa_id de sucursal:', error);
                }
            }

            const registroData = {
                user_id: finalUserId,
                personal_id: finalPersonalId,
                producto_almacen_id,
                lote: parseFloat(lote),
                proceso,
                microondas: parseFloat(microondas) || 0,
                terminados: parseFloat(terminados),
                vencimiento: `${vencimiento}-01`,
                sucursal_id: finalSucuId,
                observaciones: observaciones || null,
                empresa_id: empresaId
            };

            const result = await registrosProduccionDamabrava.create(registroData);
            if (!result.success) {
                return result;
            }

            return {
                success: true,
                message: 'Registro de producción creado correctamente',
                data: result.data
            };
        }, {
            validateSucuId: true,
            successStatus: 201
        });
    }

    // Obtener registros de producción del usuario actual
    static async getByUser(req, res) {
        return registrosProduccionDamabravaController._handleRequest(res, 'getByUser', req, async () => {
            const userId = req.user?.id;
            const userType = req.user?.type;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const search = req.query.search || '';
            const fecha_inicio = req.query.fecha_inicio || null;
            const fecha_fin = req.query.fecha_fin || null;

            const result = await registrosProduccionDamabrava.getByUser(
                userId,
                userType,
                page,
                limit,
                estado,
                ordenamiento,
                search,
                fecha_inicio,
                fecha_fin
            );

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: result.data,
                pagination: result.pagination
            };
        });
    }

    // Obtener un registro de producción por ID
    static async getById(req, res) {
        return registrosProduccionDamabravaController._handleRequest(res, 'getById', req, async () => {
            const { id } = req.params;
            const result = await registrosProduccionDamabrava.getById(id);

            if (!result.success) {
                return {
                    ...result,
                    status: 404
                };
            }

            return result;
        }, {
            validateRegistroId: true
        });
    }

    // Obtener todos los registros de producción (sin filtrar por sucursal)
    static async getAll(req, res) {
        return registrosProduccionDamabravaController._handleRequest(res, 'getAll', req, async () => {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const estado = req.query.estado || null;
            const ordenamiento = req.query.ordenamiento || 'fecha_desc';
            const search = req.query.search || '';
            const responsable_id = req.query.responsable_id || null;
            const responsable_tipo = req.query.responsable_tipo || null;
            const fecha_inicio = req.query.fecha_inicio || null;
            const fecha_fin = req.query.fecha_fin || null;

            const result = await registrosProduccionDamabrava.getAll(
                page, 
                limit, 
                estado, 
                ordenamiento, 
                search, 
                responsable_id, 
                responsable_tipo,
                fecha_inicio,
                fecha_fin
            );

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                data: result.data,
                pagination: result.pagination
            };
        });
    }

    // Eliminar un registro de producción
    static async delete(req, res) {
        return registrosProduccionDamabravaController._handleRequest(res, 'delete', req, async () => {
            const { id } = req.params;
            const result = await registrosProduccionDamabrava.delete(id);

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                message: 'Registro eliminado correctamente'
            };
        }, {
            validateRegistroId: true
        });
    }

    // Verificar un registro de producción
    static async verify(req, res) {
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

        return registrosProduccionDamabravaController._handleRequest(res, 'verify', req, async () => {
            const verificacionData = {
                cantidad_verificada: parseFloat(cantidad_verificada),
                observaciones: observaciones || null
            };

            const result = await registrosProduccionDamabrava.verify(id, verificacionData);
            if (!result.success) {
                return result;
            }

            return {
                success: true,
                message: 'Registro verificado correctamente',
                data: result.data
            };
        });
    }

    // Anular verificación de un registro de producción
    static async unverify(req, res) {
        return registrosProduccionDamabravaController._handleRequest(res, 'unverify', req, async () => {
            const { id } = req.params;
            const result = await registrosProduccionDamabrava.unverify(id);

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                message: 'Verificación anulada correctamente',
                data: result.data
            };
        }, {
            validateRegistroId: true
        });
    }

    // Actualizar cantidad ingresada de un registro de producción
    static async updateCantidadIngresada(req, res) {
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

        return registrosProduccionDamabravaController._handleRequest(res, 'updateCantidadIngresada', req, async () => {
            const result = await registrosProduccionDamabrava.updateCantidadIngresada(id, parseFloat(cantidad_ingresada));

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                message: result.message,
                data: result.data
            };
        });
    }

    // Restar cantidad ingresada cuando se anula un movimiento de producción
    static async restarCantidadIngresada(req, res) {
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

        return registrosProduccionDamabravaController._handleRequest(res, 'restarCantidadIngresada', req, async () => {
            const result = await registrosProduccionDamabrava.restarCantidadIngresada(id, parseFloat(cantidad_a_restar));

            if (!result.success) {
                return result;
            }

            return {
                success: true,
                message: result.message,
                data: result.data
            };
        });
    }
}

module.exports = registrosProduccionDamabravaController;
