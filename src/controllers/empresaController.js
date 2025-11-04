const Empresa = require('../models/Empresa');

class EmpresaController {
  // Método para actualizar el tipo de empresa
  static async updateTipo(req, res) {
    try {
      const { empresaId, tipo } = req.body;

      if (!empresaId || !tipo) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa y tipo son requeridos'
        });
      }

      // Validar que el tipo sea válido
      const tiposValidos = ['ventas', 'ventas_produccion'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo inválido. Debe ser "ventas" o "ventas_produccion"'
        });
      }

      const updatedEmpresa = await Empresa.updateTipo(empresaId, tipo);

      res.status(200).json({
        success: true,
        message: 'Tipo de empresa actualizado exitosamente',
        data: {
          empresa: {
            id: updatedEmpresa.id,
            name: updatedEmpresa.name,
            tipo: updatedEmpresa.tipo
          }
        }
      });
    } catch (error) {
      console.error('Error en updateTipo:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para obtener empresa por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa es requerido'
        });
      }

      const empresa = await Empresa.getById(id);

      if (!empresa) {
        return res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Empresa obtenida exitosamente',
        data: {
          empresa: {
            id: empresa.id,
            name: empresa.name,
            description: empresa.description,
            logo_tipo: empresa.logo_tipo,
            tipo: empresa.tipo,
            created_at: empresa.created_at
          }
        }
      });
    } catch (error) {
      console.error('Error en getById:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = EmpresaController;

