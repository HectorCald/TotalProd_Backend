const gastos = require('../models/gastos');
const { checkDeletePermission, checkUpdatePermission, checkInfoPermission } = require('../utils/permissionsHelper');

class gastosController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateSucuId = false,
      validateGastoId = false,
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

      if (validateGastoId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID del gasto es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'info') {
            hasPermission = await checkInfoPermission(personal_id);
          } else if (checkPermission === 'update') {
            hasPermission = await checkUpdatePermission(personal_id);
          } else if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para ${
                checkPermission === 'info' ? 'ver información de' :
                checkPermission === 'update' ? 'actualizar' : 'eliminar'
              } gastos`
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
      console.error(`Error en ${actionName} gastos:`, error);
      return res.status(500).json({
        success: false,
        message: error.message || `Error al ${
          actionName === 'getAll' || actionName === 'getByDateRange' ? 'obtener los' :
          actionName === 'getById' ? 'obtener el' :
          actionName === 'create' ? 'crear el' :
          actionName === 'update' ? 'actualizar el' : 'eliminar el'
        } gasto`
      });
    }
  }

  // Obtener todos los gastos con paginación
  static async getAll(req, res) {
    return gastosController._handleRequest(res, 'getAll', req, async () => {
      const { page = 1, limit = 30, search = '', metodo_pago = null, proveedor_id = null, ordenamiento = 'fecha_desc', sucu_id } = req.query;
      
      let filtroFecha = null;
      if (req.query.fecha_inicio || req.query.fecha_fin) {
        filtroFecha = {
          inicio: req.query.fecha_inicio || null,
          fin: req.query.fecha_fin || null
        };
      }
      
      return await gastos.getAll(
        parseInt(page), 
        parseInt(limit, 10), 
        search,
        metodo_pago,
        proveedor_id,
        ordenamiento, 
        sucu_id,
        filtroFecha
      );
    }, {
      validateSucuId: true
    });
  }

  // Obtener todos los gastos sin límite
  static async getAllSinLimite(req, res) {
    return gastosController._handleRequest(res, 'getAllSinLimite', req, async () => {
      const { metodo_pago = null, proveedor_id = null, search = '', sucu_id } = req.query;

      let filtroFecha = null;
      if (req.query.fecha_inicio || req.query.fecha_fin) {
        filtroFecha = {
          inicio: req.query.fecha_inicio || null,
          fin: req.query.fecha_fin || null
        };
      }

      return await gastos.getAllSinLimite(
        sucu_id,
        metodo_pago,
        filtroFecha,
        proveedor_id,
        search
      );
    }, {
      validateSucuId: true
    });
  }

  // Obtener un gasto por ID
  static async getById(req, res) {
    return gastosController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      return await gastos.getById(id);
    }, {
      validateGastoId: true,
      checkPermission: 'info'
    });
  }

  // Crear un nuevo gasto
  static async create(req, res) {
    const { valor, concepto, metodo_pago } = req.body;

    // Validaciones básicas
    if (!valor || valor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor es obligatorio y debe ser mayor a 0'
      });
    }

    if (!concepto || !concepto.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El concepto es obligatorio'
      });
    }

    if (!metodo_pago || !metodo_pago.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El método de pago es obligatorio'
      });
    }

    return gastosController._handleRequest(res, 'create', req, async () => {
      const { sucu_id, personal_id, fecha_gasto, proveedor_id } = req.body;
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

      const gastoData = {
        user_id: finalUserId,
        personal_id: finalPersonalId,
        sucu_id,
        fecha_gasto,
        valor: parseFloat(valor),
        concepto: concepto.trim(),
        metodo_pago: metodo_pago.trim(),
        proveedor_id: proveedor_id || null,
        movimiento_entrada_id: req.body.movimiento_entrada_id || null,
        movimiento_acopio_entrada_id: req.body.movimiento_acopio_entrada_id || null
      };

      return await gastos.create(gastoData);
    }, {
      validateSucuId: true,
      successStatus: 201
    });
  }

  // Actualizar un gasto
  static async update(req, res) {
    const { id } = req.params;
    const { valor, concepto, metodo_pago } = req.body;

    // Validaciones básicas
    if (valor !== undefined && valor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El valor debe ser mayor a 0'
      });
    }

    if (concepto !== undefined && !concepto.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El concepto es obligatorio'
      });
    }

    if (metodo_pago !== undefined && !metodo_pago.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El método de pago es obligatorio'
      });
    }

    return gastosController._handleRequest(res, 'update', req, async () => {
      const { fecha_gasto, proveedor_id } = req.body;

      const updateData = {
        fecha_gasto,
        valor: valor ? parseFloat(valor) : undefined,
        concepto: concepto ? concepto.trim() : undefined,
        metodo_pago: metodo_pago ? metodo_pago.trim() : undefined,
        proveedor_id: proveedor_id || null
      };

      return await gastos.update(id, updateData);
    }, {
      validateGastoId: true,
      checkPermission: 'update',
      customValidation: async () => {
        const gastoAsociado = await gastos.isAssociatedWithMovement(id);
        if (gastoAsociado) {
          return 'No se puede editar un gasto asociado a un movimiento de acopio';
        }
        return null;
      }
    });
  }

  // Eliminar un gasto
  static async delete(req, res) {
    const { id } = req.params;
    return gastosController._handleRequest(res, 'delete', req, async () => {
      // Protección: no se puede eliminar si está asociado a un movimiento o pedido
      const asociado = await gastos.isAssociatedWithMovement(id);
      if (asociado) {
        return {
          success: false,
          message: 'Este pago se generó automáticamente a partir de un registro de inventario o pedido de acopio. Para mantener la integridad financiera, debe anular el movimiento o pedido correspondiente en lugar de eliminar el pago de forma manual.',
          status: 400
        };
      }
      return await gastos.delete(id);
    }, {
      validateGastoId: true,
      checkPermission: 'delete'
    });
  }

  // Obtener gastos por rango de fechas
  static async getByDateRange(req, res) {
    return gastosController._handleRequest(res, 'getByDateRange', req, async () => {
      const { fechaInicio, fechaFin, sucu_id } = req.query;

      if (!fechaInicio || !fechaFin) {
        return {
          success: false,
          message: 'Las fechas de inicio y fin son requeridas',
          status: 400
        };
      }

      return await gastos.getByDateRange(fechaInicio, fechaFin, sucu_id);
    }, {
      validateSucuId: true
    });
  }
}

module.exports = gastosController;
