const movimientosAcopio = require('../models/movimientosAcopio');
const productsAcopio = require('../models/productsAcopio');

class movimientosAcopioController {
  // Crear un movimiento
  static async create(req, res) {
    try {
      const { product_id, type, observations, proveedor_id, cliente_id, quantity, restar_materia_prima } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Crear el movimiento principal
      const newMovimiento = await movimientosAcopio.create({
        product_id,
        type,
        observations,
        proveedor_id,
        cliente_id,
        quantity
      }, userId);

      // Procesar ingredientes si es entrada y tiene receta
      if (type === 'entrada' && restar_materia_prima) {
        try {
          // Obtener producto con receta e ingredientes
          const producto = await productsAcopio.getById(product_id, userId);
          
          if (producto && producto.recetas_acopio && producto.recetas_acopio.length > 0) {
            const receta = producto.recetas_acopio[0];
            
            if (receta && receta.recetas_acopio_detalle && receta.recetas_acopio_detalle.length > 0) {
              // Restar ingredientes del stock (SIN crear movimientos)
              await movimientosAcopio.restarIngredientes(
                producto, 
                parseFloat(quantity), 
                receta.recetas_acopio_detalle,
                userId
              );
            }
          }
        } catch (error) {
          console.error('Error procesando ingredientes:', error);
          // No fallar el movimiento principal si hay error con ingredientes
        }
      }

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

      const movimientos = await movimientosAcopio.getByProduct(productId, userId);

      res.json({
        success: true,
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

      const movimientos = await movimientosAcopio.getByCliente(clienteId, userId);

      res.json({
        success: true,
        data: movimientos
      });
    } catch (error) {
      console.error('Error en getByCliente:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
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

      const movimientos = await movimientosAcopio.getByProveedor(proveedorId, userId);

      res.json({
        success: true,
        data: movimientos
      });
    } catch (error) {
      console.error('Error en getByProveedor:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los movimientos
  static async getAll(req, res) {
    try {
      const { page = 1, limit = 20, tipo, ordenamiento = 'fecha_desc' } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const result = await movimientosAcopio.getAll(userId, parseInt(page), parseInt(limit), tipo, ordenamiento);

      res.json({
        success: true,
        data: result.movimientos,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(result.total / parseInt(limit)),
          totalItems: result.total,
          itemsPerPage: parseInt(limit)
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

  // Anular un movimiento
  static async anular(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const result = await movimientosAcopio.anular(id, userId);

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
      console.error('Error en anular:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Eliminar un movimiento
  static async eliminar(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const result = await movimientosAcopio.eliminar(id, userId);

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
      console.error('Error en eliminar:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = movimientosAcopioController;