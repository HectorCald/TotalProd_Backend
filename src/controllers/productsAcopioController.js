const productsAcopio = require('../models/productsAcopio');

class productsAcopioController {

  // Obtener todos los productos de la empresa
  static async getAll(req, res) {
    try {
      // Obtener parámetros de la query
      const empresaId = req.query.empresa_id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const categoria = req.query.categoria || null;
      const tipoMedida = req.query.tipoMedida || null;
      const ordenamiento = req.query.ordenamiento || 'nombre_asc';
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      const result = await productsAcopio.getAll(empresaId, page, limit, search, categoria, tipoMedida, ordenamiento);
      
      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: result.products,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Crear un producto
  static async create(req, res) {
    try {
      const { name, description, quantity, type_measure_id, category_id, receta, empresa_id } = req.body;

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      if (!quantity || !quantity.toString().trim()) {
        return res.status(400).json({
          success: false,
          message: 'La cantidad es obligatoria'
        });
      }

      if (!type_measure_id) {
        return res.status(400).json({
          success: false,
          message: 'El tipo de medida es obligatorio'
        });
      }

      if (!empresa_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      // Crear el producto
      const newProduct = await productsAcopio.create({
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        receta: receta
      }, empresa_id);

      // Obtener el producto creado con sus relaciones
      const productWithRelations = await productsAcopio.getById(newProduct.id, empresa_id);

      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: productWithRelations
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Eliminar un producto
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      // Eliminar el producto
      await productsAcopio.delete(id);

      res.status(200).json({
        success: true,
        message: 'Producto eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error en delete:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Actualizar un producto
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { name, description, quantity, type_measure_id, category_id, receta } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }
      // Actualizar el producto
      await productsAcopio.update(id, {
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        receta: receta
      }, null);

      // Obtener el producto actualizado con sus relaciones
      const updatedProduct = await productsAcopio.getById(id);

      res.status(200).json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: updatedProduct
      });
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }




  
  // Obtener productos por categoría
  static async getByCategory(req, res) {
    try {
      const { categoryId } = req.params;


      if (!categoryId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!categoryId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la categoría es requerido'
        });
      }

      const products = await productsAcopio.getByCategory(categoryId);

      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products
      });
    } catch (error) {
      console.error('Error en getByCategory:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Verificar si un producto tiene movimientos
  static async hasMovements(req, res) {
    try {
      const { id } = req.params;


      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      const hasMovements = await productsAcopio.hasMovements(id);

      res.status(200).json({
        success: true,
        message: 'Verificación completada',
        data: { hasMovements }
      });
    } catch (error) {
      console.error('Error en hasMovements:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  
}

module.exports = productsAcopioController;
