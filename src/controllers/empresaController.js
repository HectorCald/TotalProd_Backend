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

  // Método para buscar empresa por código
  static async searchByCodigo(req, res) {
    try {
      const { codigo } = req.query;

      if (!codigo) {
        return res.status(400).json({
          success: false,
          message: 'Código es requerido'
        });
      }

      const empresas = await Empresa.searchByCodigo(codigo);

      res.status(200).json({
        success: true,
        message: empresas.length > 0 ? 'Empresas encontradas' : 'No se encontraron empresas',
        data: {
          empresas: empresas.map(empresa => ({
            id: empresa.id,
            name: empresa.name,
            description: empresa.description,
            logo_tipo: empresa.logo_tipo,
            tipo: empresa.tipo,
            codigo: empresa.codigo,
            propietario_id: empresa.propietario_id,
            created_at: empresa.created_at
          }))
        }
      });
    } catch (error) {
      console.error('Error en searchByCodigo:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para obtener empresas disponibles
  static async getDisponibles(req, res) {
    try {
      const { currentEmpresaId } = req.query;

      const empresas = await Empresa.getAllDisponibles(currentEmpresaId);

      res.status(200).json({
        success: true,
        message: empresas.length > 0 ? 'Empresas encontradas' : 'No se encontraron empresas',
        data: {
          empresas: empresas.map(empresa => ({
            id: empresa.id,
            name: empresa.name,
            description: empresa.description,
            logo_tipo: empresa.logo_tipo,
            tipo: empresa.tipo,
            propietario_id: empresa.propietario_id,
            created_at: empresa.created_at
          }))
        }
      });
    } catch (error) {
      console.error('Error en getDisponibles:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para verificar código
  static async verificarCodigo(req, res) {
    try {
      const { id } = req.params;
      const { codigo } = req.body;

      if (!id || !codigo) {
        return res.status(400).json({
          success: false,
          message: 'ID de empresa y código son requeridos'
        });
      }

      const empresa = await Empresa.getById(id);

      if (!empresa) {
        return res.status(404).json({
          success: false,
          message: 'Empresa no encontrada'
        });
      }

      if (empresa.codigo !== codigo) {
        return res.status(400).json({
          success: false,
          message: 'Código incorrecto'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Código verificado exitosamente'
      });
    } catch (error) {
      console.error('Error en verificarCodigo:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = EmpresaController;

