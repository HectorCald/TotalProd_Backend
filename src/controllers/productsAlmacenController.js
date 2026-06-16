const productsAlmacen = require('../models/productsAlmacen');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class productsAlmacenController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validateSucuId = false,
      validateProductId = false,
      checkPermission = null,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      const empresaId = req.query.empresa_id || req.body.empresa_id;
      const sucuId = req.query.sucu_id || req.body.sucu_id;

      if (validateEmpresaId && !empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      if (validateSucuId && !sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      if (validateProductId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'ID del producto es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'create') {
            hasPermission = await checkCreatePermission(personal_id);
          } else if (checkPermission === 'update') {
            hasPermission = await checkUpdatePermission(personal_id);
          } else if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para ${checkPermission === 'delete' ? 'eliminar' : checkPermission === 'update' ? 'editar' : 'crear'} productos`
            });
          }
        }
      }

      const result = await handlerFn();
      
      const responseBody = {
        success: true,
        message: successMessage
      };

      if (result !== undefined) {
        // Manejar estructura { data, pagination, sizeInfo }
        if (result && typeof result === 'object' && result.hasOwnProperty('data')) {
          responseBody.data = result.data;
          if (result.pagination) responseBody.pagination = result.pagination;
          if (result.sizeInfo) responseBody.sizeInfo = result.sizeInfo;
        } else {
          responseBody.data = result;
        }
      }

      return res.status(successStatus).json(responseBody);
    } catch (error) {
      console.error(`Error en ${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los productos de la empresa
  static async getAll(req, res) {
    return productsAlmacenController._handleRequest(res, 'getAll', req, async () => {
      const empresaId = req.query.empresa_id;
      const sucuId = req.query.sucu_id;
      const ocultarStockCero = req.query.ocultar_stock_cero === 'true' || req.query.ocultar_stock_cero === true;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      const search = req.query.search || null;
      const categoryId = req.query.category_id || null;
      const sortOrder = req.query.sort_order || 'name_asc';

      let empresasAsociadasIds = [];
      if (req.query.empresas_asociadas) {
        const asociadas = Array.isArray(req.query.empresas_asociadas) 
          ? req.query.empresas_asociadas 
          : [req.query.empresas_asociadas];
        empresasAsociadasIds = asociadas.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '');
      }

      return await productsAlmacen.getAll(
        empresaId, 
        sucuId, 
        empresasAsociadasIds, 
        ocultarStockCero,
        page,
        limit,
        search,
        categoryId,
        sortOrder
      );
    }, {
      validateEmpresaId: true,
      validateSucuId: true,
      successMessage: 'Productos obtenidos exitosamente'
    });
  }

  // Obtener productos ligeros (solo id y name) para formularios de producción
  static async getAllForProduction(req, res) {
    return productsAlmacenController._handleRequest(res, 'getAllForProduction', req, async () => {
      const empresaId = req.query.empresa_id;
      return await productsAlmacen.getAllForProduction(empresaId);
    }, {
      validateEmpresaId: true,
      successMessage: 'Productos obtenidos exitosamente'
    });
  }

  // Obtener un producto por ID
  static async getById(req, res) {
    return productsAlmacenController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      const sucuId = req.query.sucu_id;
      const product = await productsAlmacen.getById(id, sucuId);
      if (!product) throw new Error('Producto no encontrado');
      return product;
    }, {
      validateSucuId: true,
      validateProductId: true,
      successMessage: 'Producto obtenido exitosamente'
    });
  }

  // Obtener múltiples productos por IDs con recetas
  static async getByIds(req, res) {
    return productsAlmacenController._handleRequest(res, 'getByIds', req, async () => {
      const empresaId = req.query.empresa_id;
      let ids = req.query.ids || req.query['ids[]'];
      
      if (!ids) throw new Error('IDs de productos son requeridos');
      
      if (typeof ids === 'string') {
        if (ids.includes(',')) ids = ids.split(',').map(id => id.trim());
        else ids = [ids];
      }
      
      if (!Array.isArray(ids)) ids = [ids];
      ids = ids.filter(id => id && id !== 'null' && id !== 'undefined' && String(id).trim() !== '');
      
      if (ids.length === 0) throw new Error('IDs de productos son requeridos');

      return await productsAlmacen.getByIds(ids, empresaId);
    }, {
      validateEmpresaId: true,
      successMessage: 'Productos obtenidos exitosamente'
    });
  }

  // Crear un producto
  static async create(req, res) {
    const { name, description, stock, codigo_barras, category_id, category_ids, grup, stock_minimo, costo_produccion, prices, receta, empresa_id, sucu_id } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    if (stock === undefined || stock === null || isNaN(stock) || parseInt(stock) < 0) {
      return res.status(400).json({ success: false, message: 'El stock es obligatorio y debe ser un número válido mayor o igual a 0' });
    }

    return productsAlmacenController._handleRequest(res, 'create', req, async () => {
      const optionalNum = (v) => (v != null && v !== '') ? Number(v) : null;
      return await productsAlmacen.create({
        name: name.trim(),
        description: description || null,
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        category_ids: category_ids || [],
        grup: optionalNum(grup),
        stock_minimo: optionalNum(stock_minimo),
        costo_produccion: optionalNum(costo_produccion),
        prices: prices || {},
        receta: receta || null
      }, empresa_id, sucu_id);
    }, {
      validateEmpresaId: true,
      validateSucuId: true,
      checkPermission: 'create',
      successStatus: 201,
      successMessage: 'Producto creado exitosamente'
    });
  }

  // Actualizar un producto
  static async update(req, res) {
    const { name, description, stock, codigo_barras, category_id, category_ids, grup, stock_minimo, costo_produccion, prices, receta, sucu_id } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
    if (stock === undefined || stock === null || isNaN(stock) || parseInt(stock) < 0) {
      return res.status(400).json({ success: false, message: 'El stock es obligatorio y debe ser un número válido mayor o igual a 0' });
    }

    return productsAlmacenController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      const optionalNum = (v) => (v != null && v !== '') ? Number(v) : null;
      return await productsAlmacen.update(id, {
        name: name.trim(),
        description: description || null,
        stock: parseInt(stock),
        codigo_barras: codigo_barras ? codigo_barras.trim() : null,
        category_id: category_id || null,
        category_ids: category_ids || [],
        grup: optionalNum(grup),
        stock_minimo: optionalNum(stock_minimo),
        costo_produccion: optionalNum(costo_produccion),
        prices: prices || {},
        receta: receta || null
      }, sucu_id);
    }, {
      validateSucuId: true,
      validateProductId: true,
      checkPermission: 'update',
      successMessage: 'Producto actualizado exitosamente'
    });
  }

  // Eliminar un producto
  static async delete(req, res) {
    return productsAlmacenController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await productsAlmacen.delete(id);
    }, {
      validateProductId: true,
      checkPermission: 'delete',
      successMessage: 'Producto eliminado exitosamente'
    });
  }

  // Actualizar múltiples productos en lote (para importación)
  static async bulkUpdate(req, res) {
    return productsAlmacenController._handleRequest(res, 'bulkUpdate', req, async () => {
      const { productosData, empresa_id, sucu_id } = req.body;
      const empresaId = req.user?.empresa_id || empresa_id;
      const sucuId = req.user?.sucu_id || sucu_id;

      if (!productosData || !Array.isArray(productosData)) throw new Error('Array de productos es requerido');
      const resultado = await productsAlmacen.bulkUpdate(productosData, empresaId, sucuId);
      return resultado.data; // El middleware de handleRequest pondrá successMessage, pero si quieres usar el que retorna `resultado.message` tendrás que ajustarlo
    }, {
      validateEmpresaId: true,
      successMessage: 'Productos actualizados en lote exitosamente'
    });
  }

  // Crear múltiples productos en lote (para plantillas)
  static async bulkCreate(req, res) {
    return productsAlmacenController._handleRequest(res, 'bulkCreate', req, async () => {
      const { productosData, empresa_id, sucu_id } = req.body;
      const empresaId = req.user?.empresa_id || empresa_id;
      const sucuId = req.user?.sucu_id || sucu_id;

      if (!productosData || !Array.isArray(productosData)) throw new Error('Array de productos es requerido');
      const resultado = await productsAlmacen.bulkCreate(productosData, empresaId, sucuId);
      return resultado.data;
    }, {
      validateEmpresaId: true,
      successStatus: 201,
      successMessage: 'Productos creados en lote exitosamente'
    });
  }
}

module.exports = productsAlmacenController;