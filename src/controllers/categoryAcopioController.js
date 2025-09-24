const categoryAcopio = require('../models/categoryAcopio');

class categoryAcopioController {

  // Obtener todas las categorías
  static async getAll(req, res) {
    try {
      const empresaId = req.query.empresa_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      const categories = await categoryAcopio.getAll(empresaId);
      
      res.status(200).json({
        success: true,
        message: 'Categorías obtenidas exitosamente',
        data: categories
      });
    } catch (error) {
      console.error('Error en categoryAcopioController.getAll:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear una categoría
  static async create(req, res) {
    try {
      const { name, empresa_id } = req.body;

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      if (!empresa_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      // Crear la categoría
      const newCategory = await categoryAcopio.create({
        name: name.trim()
      }, empresa_id);

      res.status(201).json({
        success: true,
        message: 'Categoría creada exitosamente',
        data: newCategory
      });
    } catch (error) {
      console.error('Error en create:', error);
      
      // Si es un error de validación (nombre duplicado), devolver 400
      if (error.message === 'Ya existe una categoría con este nombre') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Actualizar una categoría
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la categoría es requerido'
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      // Actualizar la categoría
      const updatedCategory = await categoryAcopio.update(id, {
        name: name.trim()
      });

      res.status(200).json({
        success: true,
        message: 'Categoría actualizada exitosamente',
        data: updatedCategory
      });
    } catch (error) {
      console.error('Error en update:', error);
      
      // Si es un error de validación (nombre duplicado), devolver 400
      if (error.message === 'Ya existe una categoría con este nombre') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Eliminar una categoría
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la categoría es requerido'
        });
      }

      // Eliminar la categoría
      await categoryAcopio.delete(id);

      res.status(200).json({
        success: true,
        message: 'Categoría eliminada exitosamente'
      });
    } catch (error) {
      console.error('Error en delete:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = categoryAcopioController;
