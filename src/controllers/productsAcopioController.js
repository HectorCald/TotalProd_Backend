const productsAcopio = require('../models/productsAcopio');

class productsAcopioController {

  // Obtener todos los productos
  static async getAll(req, res) {
    try {
      // Obtener el userId del usuario autenticado
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Parámetros de paginación y búsqueda
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const categoria = req.query.categoria;
      const tipoMedida = req.query.tipo_medida;
      const ordenamiento = req.query.ordenamiento || 'nombre_asc';
      const offset = (page - 1) * limit;


      const products = await productsAcopio.getAll(userId);
      
      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Obtener un producto por ID con sus lotes
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      const product = await productsAcopio.getByIdWithLotes(id, userId);

      res.status(200).json({
        success: true,
        message: 'Producto obtenido exitosamente',
        data: product
      });
    } catch (error) {
      console.error('Error en getById:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Obtener productos por categoría
  static async getByCategory(req, res) {
    try {
      const { categoryId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
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

      const products = await productsAcopio.getByCategory(categoryId, userId);

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

  // Crear un producto
  static async create(req, res) {
    try {
      const { name, description, quantity, type_measure_id, category_id, receta } = req.body;

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

      // Crear el producto
      const newProduct = await productsAcopio.create({
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        receta: receta
      }, req.user.id);

      // Obtener el producto creado con sus relaciones
      const productWithRelations = await productsAcopio.getByIdWithLotes(newProduct.id, req.user.id);

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
      await productsAcopio.delete(id, req.user.id);

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

  // Verificar si un producto tiene movimientos
  static async hasMovements(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      const hasMovements = await productsAcopio.hasMovements(id, userId);

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

      // Actualizar el producto
      await productsAcopio.update(id, {
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        receta: receta
      }, null, req.user.id);

      // Obtener el producto actualizado con sus relaciones
      const updatedProduct = await productsAcopio.getByIdWithLotes(id, req.user.id);

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
}

module.exports = productsAcopioController;
