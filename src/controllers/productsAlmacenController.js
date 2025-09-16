const productsAlmacen = require('../models/productsAlmacen');

class productsAlmacenController {

  // Obtener todos los productos de la empresa
  static async getAll(req, res) {
    try {
      // Obtener el empresa_id de la empresa seleccionada
      const empresaId = req.query.empresa_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      const products = await productsAlmacen.getAll(empresaId);
      
      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products
      });
    } catch (error) {
      console.error('Error en productsAlmacenController.getAll:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear un producto
  static async create(req, res) {
    try {
      const { name, description, stock, codigo_barras, category_id, prices, receta, empresa_id } = req.body;

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
        });
      }

      if (stock === undefined || stock === null || isNaN(stock) || parseInt(stock) < 0) {
        return res.status(400).json({
          success: false,
          message: 'El stock es obligatorio y debe ser un número válido mayor o igual a 0'
        });
      }

      if (!empresa_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      // Crear el producto
      const newProduct = await productsAlmacen.create({
        name: name.trim(),
        description: description ? description.trim() : null,
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        prices: prices || {},
        receta: receta || null
      }, empresa_id);

      res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        data: newProduct
      });
    } catch (error) {
      console.error('Error en create:', error);
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
      const { name, description, stock, codigo_barras, category_id, prices, receta } = req.body;

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

      if (stock === undefined || stock === null || isNaN(stock) || parseInt(stock) < 0) {
        return res.status(400).json({
          success: false,
          message: 'El stock es obligatorio y debe ser un número válido mayor o igual a 0'
        });
      }



      // Actualizar el producto
      const updatedProduct = await productsAlmacen.update(id, {
        name: name.trim(),
        description: description ? description.trim() : null,
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        prices: prices || {},
        receta: receta || null
      });

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
      await productsAlmacen.delete(id);

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
}

module.exports = productsAlmacenController;
