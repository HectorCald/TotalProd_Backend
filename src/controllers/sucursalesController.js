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
            const { name } = req.body;
            const userId = req.user.id;
            
            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de la sucursal es requerido'
                });
            }

            // Obtener empresa_id del usuario desde la base de datos
            const User = require('../models/User');
            const user = await User.getById(userId);
            
            if (!user || !user.empresa_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El usuario no tiene una empresa asociada'
                });
            }

            const sucursalData = {
                name: name.trim(),
                empresa_id: user.empresa_id
            };

            const result = await sucursales.create(sucursalData);
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
            const { name } = req.body;
            
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
                name: name.trim()
            };

            const result = await sucursales.update(id, sucursalData);
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
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Error en sucursalesController.delete:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
        }
    }
};

module.exports = sucursalesController;
