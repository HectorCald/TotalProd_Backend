const pedidosAlmacen = require('../models/pedidosAlmacen');
const movimientosAlmacenController = require('./movimientosAlmacenController');
const deudasController = require('./deudasController');

class pedidosAlmacenController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      requireAuth = true,
      validateSucuId = false,
      validateEmpresaId = false,
      validatePedidoId = false,
      successStatus = 200,
      errorStatus = 400,
      customValidation = null
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
        const sucuId = req.query.sucu_id || req.body.sucu_id || req.user?.sucu_id;
        if (!sucuId) {
          return res.status(400).json({
            success: false,
            message: 'ID de la sucursal es requerido'
          });
        }
        if (req.query) req.query.sucu_id = sucuId;
        if (req.body) req.body.sucu_id = sucuId;
      }

      if (validateEmpresaId) {
        const empresaId = req.query.empresa_id || req.body.empresa_id || req.user?.empresa_id;
        if (!empresaId) {
          return res.status(400).json({
            success: false,
            message: 'ID de la empresa es requerido'
          });
        }
        if (req.query) req.query.empresa_id = empresaId;
        if (req.body) req.body.empresa_id = empresaId;
      }

      if (validatePedidoId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'ID del pedido es requerido'
          });
        }
      }

      if (customValidation) {
        const validationResult = await customValidation();
        if (validationResult) {
          const message = typeof validationResult === 'string' ? validationResult : validationResult.message;
          const status = validationResult.status || 400;
          return res.status(status).json({
            success: false,
            message
          });
        }
      }

      const result = await handlerFn();

      if (!result.success) {
        const finalErrorStatus = result.status || (actionName === 'getById' && !result.data ? 404 : errorStatus);
        return res.status(finalErrorStatus).json(result);
      }

      return res.status(successStatus).json(result);
    } catch (error) {
      console.error(`Error en pedidosAlmacenController.${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Crear un pedido
  static async create(req, res) {
    const { productos, observaciones, personal_id } = req.body;

    // Validaciones básicas
    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La lista de productos es requerida'
      });
    }

    if (!req.body.precio_id) {
      return res.status(400).json({
        success: false,
        message: 'ID del precio es requerido'
      });
    }

    if (!req.body.sucursal_destino_id) {
      return res.status(400).json({
        success: false,
        message: 'ID de la sucursal de destino es requerido'
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

    return pedidosAlmacenController._handleRequest(res, 'create', req, async () => {
      const userId = req.user?.id;
      const userType = req.user?.type;

      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? personal_id : null;

      if (!finalUserId && !finalPersonalId) {
        return {
          success: false,
          message: 'Usuario no autenticado o personal no válido',
          status: 401
        };
      }

      const pedidoData = {
        productos,
        observaciones,
        precio_id: req.body.precio_id,
        sucursal_destino_id: req.body.sucursal_destino_id,
        ...(Object.prototype.hasOwnProperty.call(req.body, 'agrupado') ? { agrupado: !!req.body.agrupado } : {}),
        ...(Object.prototype.hasOwnProperty.call(req.body, 'cliente_id') ? { cliente_id: req.body.cliente_id } : {})
      };

      return await pedidosAlmacen.create(pedidoData, finalUserId, req.body.empresa_id, finalPersonalId, req.body.sucu_id);
    }, {
      validateSucuId: true,
      validateEmpresaId: true,
      successStatus: 201
    });
  }

  // DEPRECATED - Entregar pedido (flujo de negocio orquestado) - YA NO SE USA
  // La lógica ahora está en el frontend usando servicios individuales
  static async entregarPedido(req, res) {
    return res.status(410).json({ 
      success: false, 
      message: 'Este endpoint está deprecado. Use los servicios individuales desde el frontend.' 
    });
  }

  // Obtener todos los pedidos de la sucursal
  static async getAll(req, res) {
    return pedidosAlmacenController._handleRequest(res, 'getAll', req, async () => {
      const { sucu_id } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const searchQuery = req.query.search || null;
      const estado = req.query.estado || null;
      const ordenamiento = req.query.ordenamiento || 'fecha_desc';
      const responsableId = req.query.responsable_id || null;
      
      let filtroFecha = null;
      if (req.query.fecha_inicio || req.query.fecha_fin) {
        filtroFecha = {
          inicio: req.query.fecha_inicio || null,
          fin: req.query.fecha_fin || null
        };
      }

      return await pedidosAlmacen.getAll(sucu_id, page, limit, searchQuery, estado, ordenamiento, responsableId, filtroFecha);
    }, {
      validateSucuId: true
    });
  }

  // Obtener solicitantes únicos
  static async getSolicitantesUnicos(req, res) {
    return pedidosAlmacenController._handleRequest(res, 'getSolicitantesUnicos', req, async () => {
      const { sucu_id } = req.query;
      return await pedidosAlmacen.getSolicitantesUnicos(sucu_id);
    }, {
      validateSucuId: true
    });
  }

  // Obtener todos los pedidos sin límite (para reportes)
  static async getAllSinLimite(req, res) {
    return pedidosAlmacenController._handleRequest(res, 'getAllSinLimite', req, async () => {
      const { sucu_id } = req.query;
      return await pedidosAlmacen.getAllSinLimite(sucu_id);
    }, {
      validateSucuId: true
    });
  }

  // Obtener un pedido por ID
  static async getById(req, res) {
    return pedidosAlmacenController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      return await pedidosAlmacen.getById(id);
    }, {
      validatePedidoId: true
    });
  }

  // Actualizar pedido completo
  static async update(req, res) {
    const { id } = req.params;
    const { productos, observaciones, personal_id } = req.body;

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

    return pedidosAlmacenController._handleRequest(res, 'update', req, async () => {
      const userId = req.user.id;
      const userType = req.user.type;

      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? personal_id : null;

      const pedidoData = {
        productos,
        observaciones,
        precio_id: req.body.precio_id,
        ...(Object.prototype.hasOwnProperty.call(req.body, 'agrupado') ? { agrupado: !!req.body.agrupado } : {})
      };

      if (Object.prototype.hasOwnProperty.call(req.body, 'cliente_id')) {
        pedidoData.cliente_id = req.body.cliente_id;
      }

      return await pedidosAlmacen.update(id, pedidoData, finalUserId, req.body.empresa_id, finalPersonalId);
    }, {
      validatePedidoId: true,
      validateEmpresaId: true
    });
  }

  // DEPRECATED - Actualizar entrega de pedido - YA NO SE USA
  // La lógica ahora está en el frontend usando servicios individuales
  static async updateEntrega(req, res) {
    return res.status(410).json({ 
      success: false, 
      message: 'Este endpoint está deprecado. Use los servicios individuales desde el frontend.' 
    });
  }

  // Actualizar estado del pedido
  static async updateEstado(req, res) {
    const { id } = req.params;
    const { estado, movimiento_salida_id, deuda_id, movimiento_entrada_id } = req.body;

    if (!estado) {
      return res.status(400).json({
        success: false,
        message: 'Nuevo estado es requerido'
      });
    }

    // Validar estados permitidos
    const estadosPermitidos = ['Pendiente', 'Entregado', 'Completado', 'Cancelado'];
    if (!estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido. Estados permitidos: Pendiente, Entregado, Completado, Cancelado'
      });
    }

    return pedidosAlmacenController._handleRequest(res, 'updateEstado', req, async () => {
      return await pedidosAlmacen.updateEstado(id, estado, movimiento_salida_id, deuda_id, movimiento_entrada_id);
    }, {
      validatePedidoId: true
    });
  }

  // Verificar si un producto tiene pedidos asociados
  static async verificarProductoEnPedidos(req, res) {
    const { productoId } = req.params;
    if (!productoId) {
      return res.status(400).json({
        success: false,
        message: 'ID del producto es requerido'
      });
    }

    return pedidosAlmacenController._handleRequest(res, 'verificarProductoEnPedidos', req, async () => {
      return await pedidosAlmacen.verificarProductoEnPedidos(productoId);
    });
  }

  // Eliminar pedido
  static async eliminar(req, res) {
    const { id } = req.params;
    return pedidosAlmacenController._handleRequest(res, 'eliminar', req, async () => {
      return await pedidosAlmacen.eliminar(id);
    }, {
      validatePedidoId: true
    });
  }
}

module.exports = pedidosAlmacenController;
