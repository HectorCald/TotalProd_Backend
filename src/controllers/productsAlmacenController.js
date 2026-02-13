const productsAlmacen = require('../models/productsAlmacen');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class productsAlmacenController {

  // Obtener todos los productos de la empresa
  static async getAll(req, res) {
    try {
      // Obtener parámetros de la query
      const empresaId = req.query.empresa_id;
      const sucuId = req.query.sucu_id;
      const ocultarStockCero = req.query.ocultar_stock_cero === 'true' || req.query.ocultar_stock_cero === true;
      
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

      // Obtener empresas asociadas si se proporcionan
      let empresasAsociadasIds = [];
      if (req.query.empresas_asociadas) {
        const asociadas = Array.isArray(req.query.empresas_asociadas) 
          ? req.query.empresas_asociadas 
          : [req.query.empresas_asociadas];
        empresasAsociadasIds = asociadas.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '');
      }

      const products = await productsAlmacen.getAll(empresaId, sucuId, empresasAsociadasIds, ocultarStockCero);
      
      // Extraer información de tamaños si existe
      let sizeInfo = null;
      let productsData = products;
      if (products && products._sizeInfo) {
        sizeInfo = products._sizeInfo;
        // Remover _sizeInfo del array antes de enviarlo
        delete products._sizeInfo;
        productsData = products;
      }
      
      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: productsData,
        sizeInfo: sizeInfo // Incluir información de tamaños en la respuesta
      });
    } catch (error) {
      console.error('Error en productsAlmacenController.getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener productos ligeros (solo id y name) para formularios de producción
  static async getAllForProduction(req, res) {
    try {
      const empresaId = req.query.empresa_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      const products = await productsAlmacen.getAllForProduction(empresaId);
      
      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products
      });
    } catch (error) {
      console.error('Error en productsAlmacenController.getAllForProduction:', error);
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
      const sucuId = req.query.sucu_id;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del producto es requerido'
        });
      }

      if (!sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const product = await productsAlmacen.getById(id, sucuId);
      
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
      console.error('Error en productsAlmacenController.getById:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener múltiples productos por IDs con recetas
  static async getByIds(req, res) {
    try {
      const empresaId = req.query.empresa_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      // Obtener IDs de los parámetros de query
      // Express puede recibir múltiples valores del mismo nombre de diferentes formas:
      // - Como array si está configurado para hacerlo
      // - Como string único si solo hay un valor
      // - Como string con múltiples valores separados (dependiendo del parser)
      let ids = req.query.ids || req.query['ids[]'];
      
      // Si ids es undefined o null
      if (!ids) {
        return res.status(400).json({
          success: false,
          message: 'IDs de productos son requeridos'
        });
      }
      
      // Si ids es un string, puede ser un solo ID o múltiples separados por comas
      if (typeof ids === 'string') {
        // Si contiene comas, separar por comas
        if (ids.includes(',')) {
          ids = ids.split(',').map(id => id.trim());
        } else {
          // Es un solo ID
          ids = [ids];
        }
      }
      
      // Asegurar que es un array
      if (!Array.isArray(ids)) {
        ids = [ids];
      }
      
      // Filtrar valores vacíos, null o undefined
      ids = ids.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '');
      
      if (ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs de productos son requeridos'
        });
      }

      const products = await productsAlmacen.getByIds(ids, empresaId);
      
      res.status(200).json({
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products
      });
    } catch (error) {
      console.error('Error en productsAlmacenController.getByIds:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Crear un producto
  static async create(req, res) {
    try {
      const { name, stock, codigo_barras, category_id, grup, stock_minimo, costo_produccion, prices, receta, empresa_id, sucu_id } = req.body;
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

      // Numéricos opcionales: vacío → null (no 0) para consistencia crear/actualizar
      const optionalNum = (v) => (v != null && v !== '') ? Number(v) : null;

      // Crear el producto
      const newProduct = await productsAlmacen.create({
        name: name.trim(),
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        grup: optionalNum(grup),
        stock_minimo: optionalNum(stock_minimo),
        costo_produccion: optionalNum(costo_produccion),
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
      const { name, stock, codigo_barras, category_id, grup, stock_minimo, costo_produccion, prices, receta, sucu_id } = req.body;
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

      // Numéricos opcionales: vacío → null (consistencia con create)
      const optionalNum = (v) => (v != null && v !== '') ? Number(v) : null;

      // Actualizar el producto
      const updatedProduct = await productsAlmacen.update(id, {
        name: name.trim(),
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        grup: optionalNum(grup),
        stock_minimo: optionalNum(stock_minimo),
        costo_produccion: optionalNum(costo_produccion),
        prices: prices || {},
        receta: receta || null
      }, sucu_id);
      res.status(200).json({
        success: true,
        message: 'Producto actualizado exitosamente',
        data: updatedProduct
      });
    } catch (error) {
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

  // Actualizar múltiples productos en lote (para importación)
  static async bulkUpdate(req, res) {
    try {
      const { productosData, empresa_id, sucu_id } = req.body;
      const empresaId = req.user?.empresa_id || empresa_id;
      const sucuId = req.user?.sucu_id || sucu_id;

      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      if (!productosData || !Array.isArray(productosData)) {
        return res.status(400).json({
          success: false,
          message: 'Array de productos es requerido'
        });
      }

      const resultado = await productsAlmacen.bulkUpdate(productosData, empresaId, sucuId);

      res.status(200).json({
        success: true,
        message: resultado.message,
        data: resultado.data
      });
    } catch (error) {
      console.error('Error en bulkUpdate:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Crear múltiples productos en lote (para plantillas)
  static async bulkCreate(req, res) {
    try {
      const { productosData, empresa_id, sucu_id } = req.body;
      const empresaId = req.user?.empresa_id || empresa_id;
      const sucuId = req.user?.sucu_id || sucu_id;

      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      if (!productosData || !Array.isArray(productosData)) {
        return res.status(400).json({
          success: false,
          message: 'Array de productos es requerido'
        });
      }

      const resultado = await productsAlmacen.bulkCreate(productosData, empresaId, sucuId);

      res.status(201).json({
        success: true,
        message: resultado.message,
        data: resultado.data
      });
    } catch (error) {
      console.error('Error en bulkCreate:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = productsAlmacenController;
