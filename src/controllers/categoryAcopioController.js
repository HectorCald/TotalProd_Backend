const categoryAcopio = require('../models/categoryAcopio');

class categoryAcopioController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validateCategoryId = false,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      const empresaId = req.query.empresa_id || req.body.empresa_id;

      if (validateEmpresaId && !empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      if (validateCategoryId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'ID de la categoría es requerido'
          });
        }
      }

      const data = await handlerFn();

      const responseBody = {
        success: true,
        message: successMessage
      };

      if (data !== undefined) {
        responseBody.data = data;
      }

      return res.status(successStatus).json(responseBody);
    } catch (error) {
      console.error(`Error en ${actionName}:`, error);

      // Si es un error de validación (nombre duplicado), devolver 400
      if (error.message === 'Ya existe una categoría con este nombre') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener todas las categorías
  static async getAll(req, res) {
    return categoryAcopioController._handleRequest(res, 'getAll', req, async () => {
      const empresaId = req.query.empresa_id;
      return await categoryAcopio.getAll(empresaId);
    }, {
      validateEmpresaId: true,
      successMessage: 'Categorías obtenidas exitosamente'
    });
  }

  // Crear una categoría
  static async create(req, res) {
    const { name, empresa_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return categoryAcopioController._handleRequest(res, 'create', req, async () => {
      return await categoryAcopio.create({
        name: name.trim()
      }, empresa_id);
    }, {
      validateEmpresaId: true,
      successStatus: 201,
      successMessage: 'Categoría creada exitosamente'
    });
  }

  // Actualizar una categoría
  static async update(req, res) {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return categoryAcopioController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      return await categoryAcopio.update(id, {
        name: name.trim()
      });
    }, {
      validateCategoryId: true,
      successMessage: 'Categoría actualizada exitosamente'
    });
  }

  // Eliminar una categoría
  static async delete(req, res) {
    return categoryAcopioController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await categoryAcopio.delete(id);
    }, {
      validateCategoryId: true,
      successMessage: 'Categoría eliminada exitosamente'
    });
  }
}

module.exports = categoryAcopioController;
