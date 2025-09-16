const pricesTypes = require('../models/pricesTypes');

class pricesTypesController {

  // Obtener todos los tipos de precios
  static async getAll(req, res) {
    try {
      const empresaId = req.query.empresa_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      const priceTypes = await pricesTypes.getAll(empresaId);
      
      res.status(200).json({
        success: true,
        message: 'Tipos de precios obtenidos exitosamente',
        data: priceTypes
      });
    } catch (error) {
      console.error('Error en pricesTypesController.getAll:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear un tipo de precio
  static async create(req, res) {
    try {
      const { name, description, empresa_id } = req.body;

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

      // Crear el tipo de precio
      const newPriceType = await pricesTypes.create({
        name: name.trim(),
        description: description ? description.trim() : null
      }, empresa_id);

      res.status(201).json({
        success: true,
        message: 'Tipo de precio creado exitosamente',
        data: newPriceType
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Actualizar un tipo de precio
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del tipo de precio es requerido'
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      // Actualizar el tipo de precio
      const updatedPriceType = await pricesTypes.update(id, {
        name: name.trim(),
        description: description ? description.trim() : null
      });

      res.status(200).json({
        success: true,
        message: 'Tipo de precio actualizado exitosamente',
        data: updatedPriceType
      });
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Eliminar un tipo de precio
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del tipo de precio es requerido'
        });
      }

      // Eliminar el tipo de precio
      await pricesTypes.delete(id);

      res.status(200).json({
        success: true,
        message: 'Tipo de precio eliminado exitosamente'
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

module.exports = pricesTypesController;
