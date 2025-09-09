const typeMeasure = require('../models/typeMeasure');

class typeMeasureController {

  // Obtener todos los tipos de medida
  static async getAll(req, res) {
    try {
      const typeMeasures = await typeMeasure.getAll();
      
      res.status(200).json({
        success: true,
        message: 'Tipos de medida obtenidos exitosamente',
        data: typeMeasures
      });
    } catch (error) {
      console.error('Error en typeMeasureController.getAll:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = typeMeasureController;
