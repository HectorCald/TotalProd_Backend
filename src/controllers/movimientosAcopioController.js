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
          const producto = await productsAcopio.getByIdWithLotes(product_id, userId);
          
          if (producto && producto.recetas_acopio && producto.recetas_acopio.length > 0) {
            const receta = producto.recetas_acopio[0];
            
            if (receta && receta.recetas_acopio_detalle && receta.recetas_acopio_detalle.length > 0) {
              // Restar ingredientes del stock
              const movimientosIngredientes = await movimientosAcopio.restarIngredientes(
                producto, 
                parseFloat(quantity), 
                receta.recetas_acopio_detalle,
                userId
              );
              
              // Crear movimientos de consumo para cada ingrediente
              for (const movimientoIngrediente of movimientosIngredientes) {
                await movimientosAcopio.create(movimientoIngrediente, userId);
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
      const { page = 1, limit = 20 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const result = await movimientosAcopio.getAll(userId, parseInt(page), parseInt(limit));

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
}

module.exports = movimientosAcopioController;