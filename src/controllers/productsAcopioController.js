const productsAcopio = require('../models/productsAcopio');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class productsAcopioController {

  // Obtener todos los productos de la empresa
  static async getAll(req, res) {
    try {
      // Obtener parámetros de la query
      const empresaId = req.query.empresa_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      const products = await productsAcopio.getAll(empresaId);
      
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

  // Crear un producto
  static async create(req, res) {
    try {
      const { name, description, quantity, type_measure_id, category_id, stock_minimo, receta, empresa_id } = req.body;
      const userType = req.user?.type;

      // Validaciones básicas
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El nombre es obligatorio'
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

      // Verificar permisos de creación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkCreatePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para crear productos'
          });
        }
      }

      // Crear el producto
      const newProduct = await productsAcopio.create({
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        stock_minimo: stock_minimo || 0,
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
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      // Verificar permisos de eliminación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar productos'
          });
        }
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
      const { name, description, quantity, type_measure_id, category_id, stock_minimo, receta } = req.body;
      const userType = req.user?.type;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      // Verificar permisos de edición solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkUpdatePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para editar productos'
          });
        }
      }

      // Actualizar el producto
      await productsAcopio.update(id, {
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        stock_minimo: stock_minimo || 0,
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




  
  // Obtener un producto por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      const product = await productsAcopio.getById(id);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Producto obtenido exitosamente',
        data: product
      });
    } catch (error) {
      console.error('Error en getById:', error);
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
