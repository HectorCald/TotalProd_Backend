const pedidosAcopio = require('../models/pedidosAcopio');
const { checkDeletePermission, checkAnularPermission } = require('../utils/permissionsHelper');

class pedidosAcopioController {
  // Crear un pedido
  static async create(req, res) {
    try {
      const { productos, observaciones, personal_id } = req.body;
      const userId = req.user?.id;
      const userType = req.user?.type;

      // Si es empleado, usar personal_id, si es usuario normal, usar userId
      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? personal_id : null;

      if (!finalUserId && !finalPersonalId) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario no autenticado o personal no válido' 
        });
      }

      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        return res.status(400).json({ success: false, message: 'La lista de productos es requerida' });
      }

      // Validar cada producto
      for (const producto of productos) {
        if (!producto.id) {
          return res.status(400).json({ success: false, message: 'ID del producto es requerido' });
        }
        if (!producto.cantidad || producto.cantidad <= 0) {
          return res.status(400).json({ success: false, message: 'La cantidad debe ser mayor a 0' });
        }
      }

      const pedidoData = { productos, observaciones };
      const result = await pedidosAcopio.create(pedidoData, finalUserId, req.body.empresa_id, finalPersonalId, req.body.sucu_id);

      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.create:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Obtener todos los pedidos de la empresa
  static async getAll(req, res) {
    try {
      const { empresa_id } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const searchQuery = req.query.search || null;
      const estado = req.query.estado || null;
      const ordenamiento = req.query.ordenamiento || 'fecha_desc';
      const responsableId = req.query.responsable_id || null;

      if (!empresa_id) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID de la empresa es requerido' 
        });
      }

      const result = await pedidosAcopio.getAll(empresa_id, page, limit, searchQuery, estado, ordenamiento, responsableId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.getAll:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Obtener un pedido por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID del pedido es requerido' });
      }

      const result = await pedidosAcopio.getById(id, userId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.getById:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Actualizar estado de un pedido
  static async updateEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, movimiento_entrada_id } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID del pedido es requerido' });
      }

      if (!estado) {
        return res.status(400).json({ success: false, message: 'Nuevo estado es requerido' });
      }

      const estadosPermitidos = ['Pendiente', 'Entregado', 'Completado'];
      if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Estado no válido. Estados permitidos: Pendiente, Entregado, Completado, Cancelado' 
        });
      }

      const result = await pedidosAcopio.updateEstado(id, estado, userId, movimiento_entrada_id);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.updateEstado:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Verificar si un producto está en pedidos
  static async verificarProductoEnPedidos(req, res) {
    try {
      const { productoId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!productoId) {
        return res.status(400).json({ success: false, message: 'ID del producto es requerido' });
      }

      const result = await pedidosAcopio.verificarProductoEnPedidos(productoId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.verificarProductoEnPedidos:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Eliminar pedido
  static async eliminar(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userType = req.user?.type;

      // Verificar permisos de eliminación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar pedidos'
          });
        }
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID del pedido es requerido' });
      }

      const result = await pedidosAcopio.eliminar(id, userId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(404).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.eliminar:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Entregar pedido
  static async entregar(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userType = req.user?.type;
      console.log('Usuario completo:', req.user);
      const userName = req.user?.name || 
                      (req.user?.first_name && req.user?.last_name ? 
                        `${req.user.first_name} ${req.user.last_name}` : 
                        req.user?.first_name || 
                        req.user?.email || 
                        'Usuario');
      console.log('Nombre de usuario extraído:', userName);
      
      const { 
        cantidadEntregada, 
        unidadEntregada, 
        cantidadUD, 
        unidadUD, 
        proveedor_id, 
        costo, 
        transporte_otros,
        metodo_pago, 
        estado_entrega, 
        observaciones,
        entregado_por // Nombre directo de la persona, NO un ID
      } = req.body;
      
      console.log('entregado_por desde frontend:', entregado_por);

      // Si es empleado, usar personal_id; si es usuario normal, usar user_id
      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? userId : null;

      if (!finalUserId && !finalPersonalId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID del pedido es requerido' });
      }

      // Validaciones de campos requeridos
      if (!cantidadEntregada || cantidadEntregada <= 0) {
        return res.status(400).json({ success: false, message: 'La cantidad entregada es requerida y debe ser mayor a 0' });
      }

      if (!cantidadUD || cantidadUD <= 0) {
        return res.status(400).json({ success: false, message: 'La cantidad en unidades es requerida y debe ser mayor a 0' });
      }

      if (!proveedor_id) {
        return res.status(400).json({ success: false, message: 'El proveedor es requerido' });
      }

      if (!costo || costo <= 0) {
        return res.status(400).json({ success: false, message: 'El costo es requerido y debe ser mayor a 0' });
      }

      if (!metodo_pago) {
        return res.status(400).json({ success: false, message: 'El método de pago es requerido' });
      }

      if (!estado_entrega) {
        return res.status(400).json({ success: false, message: 'El estado de entrega es requerido' });
      }

      const entregaData = {
        cantidadEntregada: parseFloat(cantidadEntregada),
        unidadEntregada,
        cantidadUD: parseInt(cantidadUD),
        unidadUD,
        proveedor_id,
        costo: parseFloat(costo),
        transporte_otros: transporte_otros !== undefined && transporte_otros !== null && transporte_otros !== '' ? parseFloat(transporte_otros) : null,
        metodo_pago,
        estado_entrega,
        observaciones: observaciones || null,
        entregado_por: entregado_por || userName, // Nombre directo, no ID - se guarda como texto
        fecha_entregado: new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
      };

      const result = await pedidosAcopio.entregar(id, entregaData, finalUserId, finalPersonalId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.entregar:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }

  // Anular entrega de pedido
  static async anularEntrega(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userType = req.user?.type;

      // Verificar permisos de anulación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkAnularPermission(personal_id);
        
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para anular entregas de pedidos'
          });
        }
      }

      if (!userId) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID del pedido es requerido' });
      }

      const result = await pedidosAcopio.anularEntrega(id, userId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error en pedidosAcopioController.anularEntrega:', error);
      return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
}

module.exports = pedidosAcopioController;