const pedidosAlmacen = require('../models/pedidosAlmacen');

class pedidosAlmacenController {
  // Crear un pedido
  static async create(req, res) {
    try {
      const { productos, observaciones } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Validaciones básicas
      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La lista de productos es requerida'
        });
      }

      // Validar cada producto
      for (const producto of productos) {
        if (!producto.id) {
          return res.status(400).json({
            success: false,
            message: 'ID del producto es requerido'
          });
        }

        if (!producto.cantidad || producto.cantidad <= 0) {
          return res.status(400).json({
            success: false,
            message: 'La cantidad debe ser mayor a 0'
          });
        }
      }

      const pedidoData = {
        productos,
        observaciones
      };

      const result = await pedidosAlmacen.create(pedidoData, userId, req.body.empresa_id);

      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAlmacenController.create:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los pedidos de la empresa
  static async getAll(req, res) {
    try {
      const { empresa_id } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      if (!empresa_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      const result = await pedidosAlmacen.getAll(empresa_id, page, limit);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAlmacenController.getAll:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener un pedido por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del pedido es requerido'
        });
      }

      const result = await pedidosAlmacen.getById(id);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAlmacenController.getById:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Actualizar estado del pedido
  static async updateEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del pedido es requerido'
        });
      }

      if (!estado) {
        return res.status(400).json({
          success: false,
          message: 'Nuevo estado es requerido'
        });
      }

      // Validar estados permitidos
      const estadosPermitidos = ['Pendiente', 'En Proceso', 'Completado', 'Cancelado'];
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado no válido. Estados permitidos: Pendiente, En Proceso, Completado, Cancelado'
        });
      }

      const result = await pedidosAlmacen.updateEstado(id, estado);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAlmacenController.updateEstado:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Verificar si un producto tiene pedidos asociados
  static async verificarProductoEnPedidos(req, res) {
    try {
      const { productoId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!productoId) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      const result = await pedidosAlmacen.verificarProductoEnPedidos(productoId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAlmacenController.verificarProductoEnPedidos:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Eliminar pedido
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

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del pedido es requerido'
        });
      }

      const result = await pedidosAlmacen.eliminar(id);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAlmacenController.eliminar:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = pedidosAlmacenController;
