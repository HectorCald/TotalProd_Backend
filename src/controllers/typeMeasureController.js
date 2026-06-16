const typeMeasure = require('../models/typeMeasure');

class typeMeasureController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      requireAuth = true,
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

      const result = await handlerFn();

      return res.status(successStatus).json(result);
    } catch (error) {
      console.error(`Error en typeMeasureController.${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los tipos de medida
  static async getAll(req, res) {
    return typeMeasureController._handleRequest(res, 'getAll', req, async () => {
      const typeMeasures = await typeMeasure.getAll();
      return {
        success: true,
        message: 'Tipos de medida obtenidos exitosamente',
        data: typeMeasures
      };
    });
  }
}

module.exports = typeMeasureController;
