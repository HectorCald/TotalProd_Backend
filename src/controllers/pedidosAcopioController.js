const pedidosAcopio = require('../models/pedidosAcopio');
const gastosModel = require('../main/pagos/gastos');
const { checkDeletePermission, checkAnularPermission } = require('../utils/permissionsHelper');

class pedidosAcopioController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      requireAuth = true,
      validateSucuId = false,
      validateEmpresaId = false,
      validatePedidoId = false,
      checkPermission = null,
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
            message: 'El ID de la sucursal es requerido'
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
            message: 'El ID de la empresa es requerido'
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
            message: 'El ID del pedido es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
          } else if (checkPermission === 'anular') {
            hasPermission = await checkAnularPermission(personal_id);
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para ${
                checkPermission === 'delete' ? 'eliminar' : 'anular entregas de'
              } pedidos`
            });
          }
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
      console.error(`Error en pedidosAcopioController.${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Ocurrió un error inesperado'
      });
    }
  }

  // Crear un pedido
  static async create(req, res) {
    const { productos, observaciones, personal_id } = req.body;

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

    return pedidosAcopioController._handleRequest(res, 'create', req, async () => {
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

      const pedidoData = { productos, observaciones };
      return await pedidosAcopio.create(pedidoData, finalUserId, req.body.empresa_id, finalPersonalId, req.body.sucu_id);
    }, {
      validateSucuId: true,
      validateEmpresaId: true,
      successStatus: 201
    });
  }

  // Obtener todos los pedidos de la empresa
  static async getAll(req, res) {
    return pedidosAcopioController._handleRequest(res, 'getAll', req, async () => {
      const { empresa_id } = req.query;
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

      return await pedidosAcopio.getAll(empresa_id, page, limit, searchQuery, estado, ordenamiento, responsableId, filtroFecha);
    }, {
      validateEmpresaId: true
    });
  }

  // Obtener un pedido por ID
  static async getById(req, res) {
    return pedidosAcopioController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      const userId = req.user.id;
      return await pedidosAcopio.getById(id, userId);
    }, {
      validatePedidoId: true
    });
  }

  // Actualizar estado de un pedido
  static async updateEstado(req, res) {
    const { id } = req.params;
    const { estado, movimiento_entrada_id } = req.body;

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

    return pedidosAcopioController._handleRequest(res, 'updateEstado', req, async () => {
      const userId = req.user.id;
      return await pedidosAcopio.updateEstado(id, estado, userId, movimiento_entrada_id);
    }, {
      validatePedidoId: true
    });
  }

  // Verificar si un producto está en pedidos
  static async verificarProductoEnPedidos(req, res) {
    const { productoId } = req.params;
    if (!productoId) {
      return res.status(400).json({ success: false, message: 'ID del producto es requerido' });
    }

    return pedidosAcopioController._handleRequest(res, 'verificarProductoEnPedidos', req, async () => {
      return await pedidosAcopio.verificarProductoEnPedidos(productoId);
    });
  }

  // Eliminar pedido
  static async eliminar(req, res) {
    return pedidosAcopioController._handleRequest(res, 'eliminar', req, async () => {
      const { id } = req.params;
      const userId = req.user.id;
      return await pedidosAcopio.eliminar(id, userId);
    }, {
      validatePedidoId: true,
      checkPermission: 'delete'
    });
  }

  // Entregar pedido
  static async entregar(req, res) {
    const { id } = req.params;
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
      entregado_por 
    } = req.body;

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

    return pedidosAcopioController._handleRequest(res, 'entregar', req, async () => {
      const userId = req.user.id;
      const userType = req.user.type;
      const userName = req.user.name ||
                      (req.user.first_name && req.user.last_name ?
                        `${req.user.first_name} ${req.user.last_name}` :
                        req.user.first_name ||
                        req.user.email ||
                        'Usuario');

      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? userId : null;

      if (!finalUserId && !finalPersonalId) {
        return { success: false, message: 'Usuario no autenticado', status: 401 };
      }

      // ── Obtener info del pedido para el concepto del gasto ───────────────
      const { supabase } = require('../config/supabase');
      const { data: pedidoInfo } = await supabase
        .from('pedidos_acopio')
        .select('sucu_id, producto_acopio:producto_acopio_id(name)')
        .eq('id', id)
        .single();

      const sucu_id = pedidoInfo?.sucu_id;
      const nombreProducto = pedidoInfo?.producto_acopio?.name || 'Producto';
      const concepto = `${nombreProducto} - ${cantidadEntregada} ${unidadEntregada}`;

      // ── Fecha en zona horaria de Bolivia ────────────────────────────
      const ahora = new Date();
      const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/La_Paz', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(ahora);
      const fechaBolivia = `${partes.find(p => p.type === 'year').value}-${partes.find(p => p.type === 'month').value}-${partes.find(p => p.type === 'day').value}`;

      // ── Crear gasto principal (costo) ──────────────────────────────
      const gastoBase = {
        concepto,
        valor: parseFloat(costo),
        metodo_pago,
        proveedor_id,
        observaciones: observaciones || null,
        fecha_gasto: fechaBolivia,
        sucu_id
      };
      if (finalPersonalId) gastoBase.personal_id = finalPersonalId;
      else if (finalUserId) gastoBase.user_id = finalUserId;

      const gastoResult = await gastosModel.create(gastoBase);
      if (!gastoResult.success) {
        return { success: false, message: `Error al crear el gasto: ${gastoResult.message}` };
      }
      const gastoIdCreado = gastoResult.data.id;

      // ── Crear gasto transporte/otros (si aplica) ───────────────────
      let gastoOtrosIdCreado = null;
      const transporteNum = transporte_otros !== undefined && transporte_otros !== null && transporte_otros !== ''
        ? parseFloat(transporte_otros) : 0;

      if (transporteNum > 0) {
        const gastoOtros = {
          concepto: `Transporte y/o otros (Compra '${nombreProducto}')`,
          valor: transporteNum,
          metodo_pago,
          proveedor_id,
          observaciones: observaciones || null,
          fecha_gasto: fechaBolivia,
          sucu_id
        };
        if (finalPersonalId) gastoOtros.personal_id = finalPersonalId;
        else if (finalUserId) gastoOtros.user_id = finalUserId;

        const gastoOtrosResult = await gastosModel.create(gastoOtros);
        if (!gastoOtrosResult.success) {
          // Rollback gasto principal
          await gastosModel.delete(gastoIdCreado);
          return { success: false, message: `Error al crear gasto de transporte: ${gastoOtrosResult.message}` };
        }
        gastoOtrosIdCreado = gastoOtrosResult.data.id;
      }

      // ── Llamar al modelo con los IDs de gastos ya creados ──────────────
      const entregaData = {
        cantidadEntregada: parseFloat(cantidadEntregada),
        unidadEntregada,
        cantidadUD: parseInt(cantidadUD),
        unidadUD,
        estado_entrega,
        observaciones: observaciones || null,
        entregado_por: entregado_por || userName,
        fecha_entregado: fechaBolivia,
        gasto_id: gastoIdCreado,
        gasto_otros_id: gastoOtrosIdCreado
      };

      const result = await pedidosAcopio.entregar(id, entregaData);
      if (!result.success) {
        // Rollback gastos
        if (gastoOtrosIdCreado) await gastosModel.delete(gastoOtrosIdCreado);
        await gastosModel.delete(gastoIdCreado);
        return result;
      }
      return result;
    }, {
      validatePedidoId: true
    });
  }

  // Obtener solicitantes únicos
  static async getSolicitantesUnicos(req, res) {
    return pedidosAcopioController._handleRequest(res, 'getSolicitantesUnicos', req, async () => {
      const { empresa_id } = req.query;
      return await pedidosAcopio.getSolicitantesUnicos(empresa_id);
    }, {
      validateEmpresaId: true
    });
  }

  // Anular entrega de pedido
  static async anularEntrega(req, res) {
    return pedidosAcopioController._handleRequest(res, 'anularEntrega', req, async () => {
      const { id } = req.params;

      // Modelo limpia el pedido y devuelve los IDs de gastos a eliminar
      const result = await pedidosAcopio.anularEntrega(id);
      if (!result.success) return result;

      // Controlador elimina los gastos
      const { gasto_id, gasto_otros_id } = result.gastosPendientesEliminar || {};
      if (gasto_otros_id) await gastosModel.delete(gasto_otros_id);
      if (gasto_id) await gastosModel.delete(gasto_id);

      return { success: true, message: result.message, data: result.data };
    }, {
      validatePedidoId: true,
      checkPermission: 'anular'
    });
  }
}

module.exports = pedidosAcopioController;