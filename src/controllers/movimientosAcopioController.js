const movimientosAcopio = require('../models/movimientosAcopio');

class movimientosAcopioController {
  // Crear un movimiento
  static async create(req, res) {
    try {
      const { product_id, type, observations, proveedor_id, cliente_id, quantity } = req.body;
      const userId = req.user?.id;


      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Validaciones básicas
      if (!product_id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de movimiento es requerido'
        });
      }

      // Las observaciones son opcionales

      if (!quantity || !quantity.toString().trim()) {
        return res.status(400).json({
          success: false,
          message: 'La cantidad es requerida'
        });
      }

      // Validar que el tipo sea válido
      if (!['entrada', 'salida'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de movimiento debe ser "entrada" o "salida"'
        });
      }

      // Crear el movimiento
      const newMovimiento = await movimientosAcopio.create({
        product_id,
        type,
        observations: observations ? observations.trim() : null,
        proveedor_id: proveedor_id || null,
        cliente_id: cliente_id || null,
        quantity: quantity.toString().trim()
      }, userId);

      res.status(201).json({
        success: true,
        message: 'Movimiento creado exitosamente',
        data: newMovimiento
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener movimientos por producto
  static async getByProduct(req, res) {
    try {
      const { productId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      const movimientos = await movimientosAcopio.getByProduct(productId, userId);

      res.status(200).json({
        success: true,
        message: 'Movimientos obtenidos exitosamente',
        data: movimientos
      });
    } catch (error) {
      console.error('Error en getByProduct:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los movimientos
  static async getAll(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Parámetros de paginación
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const result = await movimientosAcopio.getAllPaginated(userId, { page, limit, offset });

      res.status(200).json({
        success: true,
        message: 'Movimientos obtenidos exitosamente',
        data: result.movimientos,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(result.total / limit),
          totalItems: result.total,
          hasNextPage: page < Math.ceil(result.total / limit),
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener movimientos por cliente
  static async getByCliente(req, res) {
    try {
      const { clienteId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!clienteId) {
        return res.status(400).json({
          success: false,
          message: 'ID del cliente es requerido'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await movimientosAcopio.getByCliente(clienteId, page, limit);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en getByCliente:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener movimientos por proveedor
  static async getByProveedor(req, res) {
    try {
      const { proveedorId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!proveedorId) {
        return res.status(400).json({
          success: false,
          message: 'ID del proveedor es requerido'
        });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await movimientosAcopio.getByProveedor(proveedorId, page, limit);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en getByProveedor:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = movimientosAcopioController;
