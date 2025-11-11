const sucursales = require('../models/sucursales');

const sucursalesController = {
    // Obtener sucursales por empresa
    async getByEmpresaId(req, res) {
        try {
            const { empresaId } = req.params;
            
            if (!empresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de empresa es requerido'
                });
            }

            const result = await sucursales.getByEmpresaId(empresaId);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error en sucursalesController.getByEmpresaId:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener sucursal por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de sucursal es requerido'
                });
            }

            const result = await sucursales.getById(id);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error en sucursalesController.getById:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Crear nueva sucursal
    async create(req, res) {
        try {
            const { name, almacen_sucursal_id, precios } = req.body;
            const authUser = req.user || {};
            
            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de la sucursal es requerido'
                });
            }

            let empresaId = null;

            if (authUser?.type === 'employee') {
                // Para empleados, tomar la empresa directamente del token
                empresaId = authUser.empresa_id || null;
            } else {
                // Para usuarios propietarios (o tokens antiguos), obtener desde el modelo User
                const User = require('../models/User');
                const user = await User.getById(authUser.id);
                
                if (user && user.empresa_id) {
                    empresaId = user.empresa_id;
                }
            }

            if (!empresaId) {
                return res.status(400).json({
                    success: false,
                    message: 'El usuario no tiene una empresa asociada'
                });
            }

            const sucursalData = {
                name: name.trim(),
                empresa_id: empresaId,
                // Si viene almacen_sucursal_id (switch inactivo), persistirlo
                ...(almacen_sucursal_id ? { almacen_sucursal_id } : {})
            };

            const result = await sucursales.create(sucursalData, precios);
            if (result.success) {
                res.status(201).json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error en sucursalesController.create:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
        }
    },

    // Actualizar sucursal
    async update(req, res) {
        try {
            const { id } = req.params;
            const { name, almacen_sucursal_id, precios } = req.body;
            
            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de la sucursal es requerido'
                });
            }

            // Verificar si es la sucursal "Casa Matriz"
            const sucursalActual = await sucursales.getById(id);
            if (sucursalActual.success && sucursalActual.data.name === 'Casa Matriz') {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede editar la sucursal principal "Casa Matriz"'
                });
            }

            const sucursalData = {
                name: name.trim(),
                ...(typeof almacen_sucursal_id !== 'undefined' ? { almacen_sucursal_id } : {})
            };

            const result = await sucursales.update(id, sucursalData, precios);
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error en sucursalesController.update:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
        }
    },

    // Eliminar sucursal
    async delete(req, res) {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de sucursal es requerido'
                });
            }
            
            // Verificar si es la sucursal "Casa Matriz"
            const sucursalActual = await sucursales.getById(id);
            if (sucursalActual.success && sucursalActual.data.name === 'Casa Matriz') {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar la sucursal principal "Casa Matriz"'
                });
            }
            
            const result = await sucursales.delete(id);
            if (result.success) {
                res.json(result);
            } else {
                // Determinar el código de estado apropiado basado en el tipo de error
                let statusCode = 500;
                
                if (result.message.includes('no existe')) {
                    statusCode = 404;
                } else if (result.message.includes('No se puede eliminar') || 
                          result.message.includes('tiene registros relacionados') ||
                          result.message.includes('tiene movimientos') ||
                          result.message.includes('tiene pedidos') ||
                          result.message.includes('tiene personal')) {
                    statusCode = 409; // Conflict
                } else if (result.message.includes('Error de base de datos')) {
                    statusCode = 500;
                }
                
                res.status(statusCode).json(result);
            }
        } catch (error) {
            console.error('Error en sucursalesController.delete:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error interno del servidor al eliminar la sucursal', 
                error: error.message 
            });
        }
    },

    // Obtener precios por sucursal
    async getPreciosBySucursalId(req, res) {
        try {
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de sucursal es requerido'
                });
            }

            const result = await sucursales.getPreciosBySucursalId(id);
            
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error en sucursalesController.getPreciosBySucursalId:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
};

module.exports = sucursalesController;
