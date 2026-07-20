const productsAcopio = require('../models/productsAcopio');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class productsAcopioController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      requireAuth = true,
      validateEmpresaId = false,
      validateProductId = false,
      checkPermission = null,
      successStatus = 200,
      errorStatus = 400
    } = options;

    try {
      if (requireAuth) {
        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'Usuario no autenticado'
          });
        }
      }

      if (validateEmpresaId) {
        const empresaId = req.query.empresa_id || req.body.empresa_id || req.user?.empresa_id;
        if (!empresaId) {
          return res.status(400).json({
            success: false,
            message: 'El ID de la empresa es requerido'
          });
        }
        if (req.query) req.query.empresa_id = empresaId;
        if (req.body) req.body.empresa_id = empresaId;
      }

      if (validateProductId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID del producto es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          let message = '';
          if (checkPermission === 'create') {
            hasPermission = await checkCreatePermission(personal_id);
            message = 'No tienes permisos para crear productos';
          } else if (checkPermission === 'update') {
            hasPermission = await checkUpdatePermission(personal_id);
            message = 'No tienes permisos para editar productos';
          } else if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
            message = 'No tienes permisos para eliminar productos';
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message
            });
          }
        }
      }

      const result = await handlerFn();

      if (!result.success) {
        const finalErrorStatus = result.status || errorStatus;
        return res.status(finalErrorStatus).json(result);
      }

      return res.status(successStatus).json(result);
    } catch (error) {
      console.error(`Error en productsAcopioController.${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Ocurrió un error inesperado'
      });
    }
  }

  // Obtener todos los productos de la empresa
  static async getAll(req, res) {
    return productsAcopioController._handleRequest(res, 'getAll', req, async () => {
      const empresaId = req.query.empresa_id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 30;
      const search = req.query.search || null;
      const categoryId = req.query.category_id || null;
      const sortOrder = req.query.sort_order || 'name_asc';
      
      let empresasAsociadasIds = [];
      if (req.query['empresas_asociadas[]'] || req.query.empresas_asociadas) {
        const asociadas = req.query.empresas_asociadas 
          ? (Array.isArray(req.query.empresas_asociadas) ? req.query.empresas_asociadas : [req.query.empresas_asociadas])
          : (Array.isArray(req.query['empresas_asociadas[]']) ? req.query['empresas_asociadas[]'] : [req.query['empresas_asociadas[]']]);
        empresasAsociadasIds = asociadas.filter(id => id && id !== 'null' && id !== 'undefined');
      }

      const result = await productsAcopio.getAll(
        empresaId, 
        empresasAsociadasIds,
        page,
        limit,
        search,
        categoryId,
        sortOrder
      );
      
      return {
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: result.data,
        pagination: result.pagination,
        sizeInfo: result.sizeInfo
      };
    }, {
      validateEmpresaId: true
    });
  }

  // Obtener productos para conteo
  static async getProductsForConteo(req, res) {
    return productsAcopioController._handleRequest(res, 'getProductsForConteo', req, async () => {
      const empresaId = req.query.empresa_id;
      const products = await productsAcopio.getProductsForConteo(empresaId);

      return {
        success: true,
        message: 'Productos para conteo obtenidos correctamente',
        data: products
      };
    }, {
      validateEmpresaId: true
    });
  }

  // Obtener todos los productos para selector de receta (sin paginación)
  static async getProductsForReceta(req, res) {
    return productsAcopioController._handleRequest(res, 'getProductsForReceta', req, async () => {
      const empresaId = req.query.empresa_id;
      const products = await productsAcopio.getAllForReceta(empresaId);

      return {
        success: true,
        message: 'Productos para receta obtenidos correctamente',
        data: products
      };
    }, {
      validateEmpresaId: true
    });
  }

  // Crear un producto
  static async create(req, res) {
    const { name, description, quantity, type_measure_id, category_id, stock_minimo, receta } = req.body;

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

    return productsAcopioController._handleRequest(res, 'create', req, async () => {
      const newProduct = await productsAcopio.create({
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        stock_minimo: stock_minimo || 0,
        receta: receta
      }, req.body.empresa_id);

      const productWithRelations = await productsAcopio.getById(newProduct.id, req.body.empresa_id);

      return {
        success: true,
        message: 'Producto creado correctamente',
        data: productWithRelations
      };
    }, {
      validateEmpresaId: true,
      checkPermission: 'create',
      successStatus: 201
    });
  }

  // Eliminar un producto
  static async delete(req, res) {
    return productsAcopioController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await productsAcopio.delete(id);

      return {
        success: true,
        message: 'Producto eliminado correctamente'
      };
    }, {
      validateProductId: true,
      checkPermission: 'delete'
    });
  }

  // Actualizar un producto
  static async update(req, res) {
    const { id } = req.params;
    const { name, description, quantity, type_measure_id, category_id, stock_minimo, receta } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'El ID del producto es requerido'
      });
    }

    return productsAcopioController._handleRequest(res, 'update', req, async () => {
      await productsAcopio.update(id, {
        name: name.trim(),
        description: description?.trim() || null,
        quantity: quantity,
        type_measure_id: type_measure_id,
        category_id: category_id || null,
        stock_minimo: stock_minimo || 0,
        receta: receta
      }, null);

      const updatedProduct = await productsAcopio.getById(id);

      return {
        success: true,
        message: 'Producto actualizado correctamente',
        data: updatedProduct
      };
    }, {
      checkPermission: 'update'
    });
  }

  // Obtener un producto por ID
  static async getById(req, res) {
    return productsAcopioController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      const product = await productsAcopio.getById(id);

      if (!product) {
        return {
          success: false,
          status: 404,
          message: 'Producto no encontrado'
        };
      }

      return {
        success: true,
        message: 'Producto obtenido correctamente',
        data: product
      };
    }, {
      validateProductId: true
    });
  }

  // Obtener productos por categoría
  static async getByCategory(req, res) {
    const { categoryId } = req.params;

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'ID de la categoría es requerido'
      });
    }

    return productsAcopioController._handleRequest(res, 'getByCategory', req, async () => {
      const products = await productsAcopio.getByCategory(categoryId);

      return {
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: products
      };
    });
  }

  // Verificar si un producto tiene movimientos
  static async hasMovements(req, res) {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'El ID del producto es requerido'
      });
    }

    return productsAcopioController._handleRequest(res, 'hasMovements', req, async () => {
      const hasMovements = await productsAcopio.hasMovements(id);

      return {
        success: true,
        message: 'Verificación completada',
        data: { hasMovements }
      };
    });
  }
}

module.exports = productsAcopioController;
