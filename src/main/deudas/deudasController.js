const deudas = require('./deudas');
const { supabase } = require('../../config/supabase');
const { checkDeletePermission, checkUpdatePermission } = require('../../utils/permissionsHelper');
const { parseFiltroFecha } = require('../../utils/fechaRangeHelper');

class deudasController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateSucuId = false,
      validateDeudaId = false,
      checkPermission = null,
      successStatus = 200,
      errorStatus = 400,
      customValidation = null
    } = options;

    try {
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

      if (validateDeudaId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID de la deuda es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'update') {
            hasPermission = await checkUpdatePermission(personal_id);
          } else if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para ${
                checkPermission === 'update' ? 'actualizar' : 'eliminar'
              } deudas`
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
      console.error(`Error en ${actionName} deudas:`, error);
      return res.status(500).json({
        success: false,
        message: 'Ocurrió un error inesperado'
      });
    }
  }

  // Obtener todas las deudas sin límite
  static async getAllSinLimite(req, res) {
    return deudasController._handleRequest(res, 'getAllSinLimite', req, async () => {
      const { sucu_id } = req.query;
      const filtroFecha = parseFiltroFecha(req.query);
      return await deudas.getAllSinLimite(sucu_id, filtroFecha);
    }, {
      validateSucuId: true
    });
  }

  // Obtener todas las deudas con paginación
  static async getAll(req, res) {
    return deudasController._handleRequest(res, 'getAll', req, async () => {
      const { page = 1, limit = 10, search = '', estado = null, cliente_id = null, ordenamiento = 'fecha_desc', sucu_id } = req.query;
      const filtroFecha = parseFiltroFecha(req.query);

      return await deudas.getAll(
        parseInt(page), 
        parseInt(limit), 
        search,
        estado,
        cliente_id,
        ordenamiento, 
        sucu_id,
        filtroFecha
      );
    }, {
      validateSucuId: true
    });
  }

  // Obtener una deuda por ID
  static async getById(req, res) {
    return deudasController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      return await deudas.getById(id);
    }, {
      validateDeudaId: true
    });
  }

  // Crear una nueva deuda
  static async create(req, res) {
    const { monto_total, concepto, fecha_vencimiento } = req.body;

    if (!monto_total || monto_total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto total es obligatorio y debe ser mayor a 0'
      });
    }

    if (!concepto || !concepto.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El concepto es obligatorio'
      });
    }

    if (!fecha_vencimiento) {
      return res.status(400).json({
        success: false,
        message: 'La fecha de vencimiento es obligatoria'
      });
    }

    return deudasController._handleRequest(res, 'create', req, async () => {
      const { sucu_id, personal_id, fecha_deuda, cliente_id, movimiento_salida_id, destino_sucursal_id } = req.body;
      const user_id = req.user?.id;
      const userType = req.user?.type;

      const finalUserId = userType === 'employee' ? null : user_id;
      const finalPersonalId = userType === 'employee' ? personal_id : null;

      if (!finalUserId && !finalPersonalId) {
        return {
          success: false,
          message: 'Usuario no autenticado',
          status: 401
        };
      }

      const deudaData = {
        user_id: finalUserId,
        personal_id: finalPersonalId,
        sucu_id,
        fecha_vencimiento,
        monto_total: parseFloat(monto_total),
        concepto: concepto.trim(),
        cliente_id: cliente_id || null,
        movimiento_salida_id,
        destino_sucursal_id: destino_sucursal_id || null
      };

      if (fecha_deuda) {
        deudaData.fecha_deuda = fecha_deuda;
      }

      return await deudas.create(deudaData);
    }, {
      validateSucuId: true,
      successStatus: 201
    });
  }

  // Actualizar una deuda
  static async update(req, res) {
    const { id } = req.params;
    const { fecha_deuda, fecha_vencimiento, monto_total, saldo_pendiente, concepto, estado, cliente_id } = req.body;

    if (monto_total !== undefined && monto_total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto total debe ser mayor a 0'
      });
    }

    if (concepto !== undefined && !concepto.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El concepto es obligatorio'
      });
    }

    if (saldo_pendiente !== undefined && saldo_pendiente < 0) {
      return res.status(400).json({
        success: false,
        message: 'El saldo pendiente no puede ser negativo'
      });
    }

    return deudasController._handleRequest(res, 'update', req, async () => {
      const updateData = {
        fecha_vencimiento,
        monto_total: monto_total !== undefined ? parseFloat(monto_total) : undefined,
        saldo_pendiente: saldo_pendiente !== undefined ? parseFloat(saldo_pendiente) : undefined,
        concepto: concepto !== undefined ? concepto.trim() : undefined,
        estado,
        cliente_id: cliente_id !== undefined ? (cliente_id || null) : undefined
      };

      if (fecha_deuda !== undefined) {
        updateData.fecha_deuda = fecha_deuda;
      }

      if (updateData.monto_total !== undefined && updateData.saldo_pendiente === undefined) {
        updateData.saldo_pendiente = updateData.monto_total;
      }

      return await deudas.update(id, updateData);
    }, {
      validateDeudaId: true,
      checkPermission: 'update'
    });
  }

  // Eliminar una deuda
  static async delete(req, res) {
    const { id } = req.params;
    return deudasController._handleRequest(res, 'delete', req, async () => {
      // Protección: no se puede eliminar si está vinculada a un movimiento
      const { data: deudaActual } = await supabase
        .from('deudas')
        .select('movimiento_salida_id')
        .eq('id', id)
        .single();
      if (deudaActual?.movimiento_salida_id) {
        return {
          success: false,
          message: 'Esta deuda se generó automáticamente a partir de un movimiento de almacén. Para mantener la integridad financiera, debe anular el movimiento correspondiente en lugar de eliminar la deuda de forma manual.',
          status: 400
        };
      }
      return await deudas.delete(id);
    }, {
      validateDeudaId: true,
      checkPermission: 'delete'
    });
  }

  // Listar pagos parciales de una deuda
  static async getPagosParciales(req, res) {
    return deudasController._handleRequest(res, 'getPagosParciales', req, async () => {
      const { id } = req.params;
      return await deudas.getPagosParciales(id);
    }, {
      validateDeudaId: true
    });
  }

  // Crear pago parcial
  static async createPagoParcial(req, res) {
    const { monto, fecha, detalle } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El monto es obligatorio y debe ser mayor a 0'
      });
    }

    return deudasController._handleRequest(res, 'createPagoParcial', req, async () => {
      const { id } = req.params;
      const userType = req.user?.type;
      const user_id = userType === 'employee' ? null : req.user?.id;
      const personal_id = userType === 'employee' ? req.user?.id : null;

      return await deudas.createPagoParcial({
        deuda_id: id,
        monto: parseFloat(monto),
        fecha,
        detalle: detalle || null,
        user_id,
        personal_id
      });
    }, {
      validateDeudaId: true,
      successStatus: 201
    });
  }

  // Eliminar un pago parcial
  static async deletePagoParcial(req, res) {
    const { id, pago_id } = req.params;
    if (!id || !pago_id) {
      return res.status(400).json({
        success: false,
        message: 'IDs requeridos'
      });
    }

    return deudasController._handleRequest(res, 'deletePagoParcial', req, async () => {
      return await deudas.deletePagoParcial(id, pago_id);
    });
  }

  // Actualizar estado de una deuda
  static async updateEstado(req, res) {
    const { id } = req.params;
    const { estado, saldo_pendiente } = req.body;

    if (!estado) {
      return res.status(400).json({
        success: false,
        message: 'El estado es requerido'
      });
    }

    const estadosValidos = ['pendiente', 'pagada', 'vencida'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: 'Estado no válido. Debe ser: pendiente, pagada o vencida'
      });
    }

    return deudasController._handleRequest(res, 'updateEstado', req, async () => {
      return await deudas.updateEstado(id, estado, saldo_pendiente);
    }, {
      validateDeudaId: true
    });
  }
}

module.exports = deudasController;
