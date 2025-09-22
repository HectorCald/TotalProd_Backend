const productsAlmacen = require('../models/productsAlmacen');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class productsAlmacenController {

  // Obtener todos los productos de la empresa
  static async getAll(req, res) {
    try {
      // Obtener parámetros de la query
      const empresaId = req.query.empresa_id;
      const sucuId = req.query.sucu_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      if (!sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const products = await productsAlmacen.getAll(empresaId, sucuId);
      
      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products
      });
    } catch (error) {
      console.error('Error en productsAlmacenController.getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Crear un producto
  static async create(req, res) {
    try {
      const { name, description, stock, codigo_barras, category_id, prices, receta, empresa_id, sucu_id } = req.body;
      const userType = req.user?.type;

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

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
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
      const newProduct = await productsAlmacen.create({
        name: name.trim(),
        description: description ? description.trim() : null,
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        prices: prices || {},
        receta: receta || null
      }, empresa_id, sucu_id);

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
      const { name, description, stock, codigo_barras, category_id, prices, receta, sucu_id } = req.body;
      const userType = req.user?.type;

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

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
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
      const updatedProduct = await productsAlmacen.update(id, {
        name: name.trim(),
        description: description ? description.trim() : null,
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        prices: prices || {},
        receta: receta || null
      }, sucu_id);

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
