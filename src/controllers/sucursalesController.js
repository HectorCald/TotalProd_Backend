const sucursales = require('../models/sucursales');

class sucursalesController {

    static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
        const {
            validateEmpresaId = false,
            validateSucursalId = false,
            successStatus = 200,
            successMessage = 'Operación exitosa'
        } = options;

        try {
            if (validateEmpresaId) {
                const empresaId = req.query.empresa_id || req.body.empresa_id;
                if (!empresaId) {
                    return res.status(400).json({
                        success: false,
                        message: 'El ID de la empresa es requerido'
                    });
                }
            }

            if (validateSucursalId) {
                const { id } = req.params;
                if (!id) {
                    return res.status(400).json({
                        success: false,
                        message: 'El ID de la sucursal es requerido'
                    });
                }
            }

            const data = await handlerFn();
            
            const responseBody = {
                success: true,
                message: successMessage
            };
            if (data !== undefined) {
                responseBody.data = data;
            }

            return res.status(successStatus).json(responseBody);
        } catch (error) {
            console.error(`Error en ${actionName}:`, error);
            
            let statusCode = 500;
            if (error.message.includes('no existe')) statusCode = 404;
            else if (error.message.includes('No se puede eliminar') || error.message.includes('tiene registros relacionados') || error.message.includes('tiene movimientos') || error.message.includes('tiene pedidos') || error.message.includes('tiene personal') || error.message.includes('Casa Matriz')) statusCode = 409;
            else if (error.message.includes('requerido') || error.message.includes('obligatorio')) statusCode = 400;

            return res.status(statusCode).json({
                success: false,
                message: 'Ocurrió un error inesperado'
            });
        }
    }

    // Obtener todas las sucursales
    static async getAll(req, res) {
        return sucursalesController._handleRequest(res, 'getAll', req, async () => {
            const empresaId = req.query.empresa_id;
            let empresasAsociadasIds = [];
            
            if (empresaId === '259a05d2-2417-47b0-8bbd-50cd5723aae1' && req.query.empresas_asociadas) {
                const asocString = Array.isArray(req.query.empresas_asociadas) 
                    ? req.query.empresas_asociadas.join(',') 
                    : String(req.query.empresas_asociadas);
                
                empresasAsociadasIds = asocString.split(',')
                    .map(id => id.trim())
                    .filter(id => id && id !== 'null' && id !== 'undefined');
            }
            return await sucursales.getAll(empresaId, empresasAsociadasIds);
        }, {
            validateEmpresaId: true,
            successMessage: 'Sucursales obtenidas exitosamente'
        });
    }

    // Obtener sucursal por ID
    static async getById(req, res) {
        return sucursalesController._handleRequest(res, 'getById', req, async () => {
            const { id } = req.params;
            return await sucursales.getById(id);
        }, {
            validateSucursalId: true,
            successMessage: 'Sucursal obtenida exitosamente'
        });
    }

    // Crear nueva sucursal
    static async create(req, res) {
        return sucursalesController._handleRequest(res, 'create', req, async () => {
            const { name, almacen_sucursal_id, precios, empresa_id } = req.body;
            
            if (!name || !name.trim()) {
                throw new Error('El nombre de la sucursal es requerido');
            }

            const sucursalData = {
                name: name.trim(),
                empresa_id: empresa_id,
                ...(almacen_sucursal_id ? { almacen_sucursal_id } : {})
            };

            return await sucursales.create(sucursalData, precios);
        }, {
            validateEmpresaId: true,
            successStatus: 201,
            successMessage: 'Sucursal creada exitosamente'
        });
    }

    // Actualizar sucursal
    static async update(req, res) {
        return sucursalesController._handleRequest(res, 'update', req, async () => {
            const { id } = req.params;
            const { name, almacen_sucursal_id, precios } = req.body;
            
            if (!name || !name.trim()) {
                throw new Error('El nombre de la sucursal es requerido');
            }

            const sucursalActual = await sucursales.getById(id);
            if (sucursalActual && sucursalActual.name === 'Casa Matriz') {
                throw new Error('No se puede editar la sucursal principal "Casa Matriz"');
            }

            const sucursalData = {
                name: name.trim(),
                ...(typeof almacen_sucursal_id !== 'undefined' ? { almacen_sucursal_id } : {})
            };

            return await sucursales.update(id, sucursalData, precios);
        }, {
            validateSucursalId: true,
            successMessage: 'Sucursal actualizada exitosamente'
        });
    }

    // Eliminar sucursal
    static async delete(req, res) {
        return sucursalesController._handleRequest(res, 'delete', req, async () => {
            const { id } = req.params;
            
            const sucursalActual = await sucursales.getById(id);
            if (sucursalActual && sucursalActual.name === 'Casa Matriz') {
                throw new Error('No se puede eliminar la sucursal principal "Casa Matriz"');
            }
            
            await sucursales.delete(id);
        }, {
            validateSucursalId: true,
            successMessage: 'Sucursal eliminada exitosamente'
        });
    }

    // Obtener precios por sucursal
    static async getPreciosBySucursalId(req, res) {
        return sucursalesController._handleRequest(res, 'getPreciosBySucursalId', req, async () => {
            const { id } = req.params;
            return await sucursales.getPreciosBySucursalId(id);
        }, {
            validateSucursalId: true,
            successMessage: 'Precios de sucursal obtenidos exitosamente'
        });
    }
}

module.exports = sucursalesController;