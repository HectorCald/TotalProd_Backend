const ConteosModel = require('../models/conteos');
const { checkDeletePermission, checkReplacePermission } = require('../utils/permissionsHelper');

class ConteosController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      requireAuth = true,
      validateSucuId = false,
      validateEmpresaId = false,
      validateConteoId = false,
      checkPermission = null,
      successStatus = 200,
      errorStatus = 400
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
        const sucuId = req.query.sucu_id || req.body.sucu_id || req.body.sucursal_id || req.user?.sucu_id;
        if (!sucuId) {
          return res.status(400).json({
            success: false,
            message: 'El ID de la sucursal es requerido'
          });
        }
        if (req.query) req.query.sucu_id = sucuId;
        if (req.body) {
          req.body.sucu_id = sucuId;
          req.body.sucursal_id = sucuId;
        }
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

      if (validateConteoId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID del conteo es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          let message = '';
          if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
            message = 'No tienes permisos para eliminar conteos';
          } else if (checkPermission === 'replace') {
            hasPermission = await checkReplacePermission(personal_id);
            message = 'No tienes permisos para reemplazar stock';
          } else if (checkPermission === 'replace_acopio') {
            hasPermission = await checkReplacePermission(personal_id);
            message = 'No tienes permisos para reemplazar stock de acopio';
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message
            });
          }
        }
      }

      const result = await handlerFn();

      if (!result.success) {
        return res.status(errorStatus).json(result);
      }

      return res.status(successStatus).json(result);
    } catch (error) {
      console.error(`[CONTEO CONTROLLER] Error en ConteosController.${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Ocurrió un error inesperado',
        error: error.message
      });
    }
  }

  static async create(req, res) {
    return ConteosController._handleRequest(res, 'create', req, async () => {
      const { tipo, observaciones, detalles } = req.body;
      const userType = req.user?.type;
      const user_id = userType === 'employee' ? null : req.user?.id;
      const personal_id = userType === 'employee' ? req.user?.id : null;

      const payload = {
        tipo,
        sucursal_id: req.body.sucursal_id,
        observaciones: observaciones || null,
        detalles: Array.isArray(detalles) ? detalles : [],
        user_id,
        personal_id
      };

      const result = await ConteosModel.create(payload);
      if (!result.success) {
        return result;
      }

      return { success: true, id: result.data.id };
    }, {
      validateSucuId: true,
      successStatus: 201
    });
  }

  static async getAll(req, res) {
    return ConteosController._handleRequest(res, 'getAll', req, async () => {
      const sucursal_id = req.query.sucu_id;
      const tipo = req.query.tipo || null;

      return await ConteosModel.getAll({ sucursal_id, tipo });
    }, {
      validateSucuId: true
    });
  }

  static async getDetalles(req, res) {
    return ConteosController._handleRequest(res, 'getDetalles', req, async () => {
      const { id } = req.params;
      return await ConteosModel.getDetalles(id);
    }, {
      validateConteoId: true
    });
  }

  static async delete(req, res) {
    return ConteosController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      return await ConteosModel.delete(id);
    }, {
      validateConteoId: true,
      checkPermission: 'delete'
    });
  }

  static async replaceStock(req, res) {
    return ConteosController._handleRequest(res, 'replaceStock', req, async () => {
      const { id } = req.params;
      return await ConteosModel.replaceStock(id);
    }, {
      validateConteoId: true,
      checkPermission: 'replace'
    });
  }

  static async replaceStockAcopio(req, res) {
    return ConteosController._handleRequest(res, 'replaceStockAcopio', req, async () => {
      const { id } = req.params;
      return await ConteosModel.replaceStockAcopio(id);
    }, {
      validateConteoId: true,
      checkPermission: 'replace_acopio'
    });
  }
}

module.exports = ConteosController;