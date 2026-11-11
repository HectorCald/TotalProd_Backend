const client = require('./clients');
const { checkDeletePermission, checkUpdatePermission } = require('../../utils/permissionsHelper');

class clientsController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateSucuId = false,
      validateClientId = false,
      checkPermission = null,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      if (validateSucuId) {
        const sucuId = req.query.branch_id || req.query.sucu_id || req.body.branch_id || req.body.sucu_id;
        if (!sucuId) {
          return res.status(400).json({
            success: false,
            message: 'El ID de la sucursal es requerido'
          });
        }
      }

      if (validateClientId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({
            success: false,
            message: 'El ID del cliente es requerido'
          });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'delete') {
            hasPermission = await checkDeletePermission(personal_id);
          } else if (checkPermission === 'update') {
            hasPermission = await checkUpdatePermission(personal_id);
          }
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: `No tienes permisos para ${checkPermission === 'delete' ? 'eliminar' : 'editar'} clientes`
            });
          }
        }
      }

      const data = await handlerFn();
      
      const responseBody = {
        success: true,
        message: successMessage
      };
      if (data !== undefined) {
        responseBody.data = data;
      }

      return res.status(successStatus).json(responseBody);
    } catch (error) {
      console.error(`Error en ${actionName}:`, error);
      return res.status(500).json({
        success: false,
        message: 'Ocurrió un error inesperado'
      });
    }
  }

  // Obtener todos los clientes de una sucursal
  static async getAll(req, res) {
    return clientsController._handleRequest(res, 'getAll', req, async () => {
      const branchId = req.query.branch_id || req.query.sucu_id;
      const isActive = req.query.is_active !== undefined ? req.query.is_active : req.query.status;
      return await client.getAll(branchId, isActive);
    }, {
      validateSucuId: true,
      successMessage: 'Clientes obtenidos exitosamente'
    });
  }

  // Crear un cliente
  static async create(req, res) {
    const { name, phone, direccion, description, total_orders, location, description_location, is_active, status, sucu_id, branch_id } = req.body;
    const targetBranchId = branch_id || sucu_id;
    const activeValue = is_active !== undefined ? is_active : status;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return clientsController._handleRequest(res, 'create', req, async () => {
      return await client.create({
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        total_orders: total_orders || 0,
        location: location || null,
        description_location: description_location?.trim() || null,
        is_active: activeValue !== undefined ? activeValue : true
      }, targetBranchId);
    }, {
      validateSucuId: true,
      successStatus: 201,
      successMessage: 'Cliente creado exitosamente'
    });
  }

  // Eliminar un cliente
  static async delete(req, res) {
    return clientsController._handleRequest(res, 'delete', req, async () => {
      const { id } = req.params;
      await client.delete(id);
    }, {
      validateClientId: true,
      checkPermission: 'delete',
      successMessage: 'Cliente eliminado exitosamente'
    });
  }

  // Actualizar un cliente
  static async update(req, res) {
    const { name, phone, direccion, description, total_orders, location, description_location, is_active, status } = req.body;
    const activeValue = is_active !== undefined ? is_active : status;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es obligatorio'
      });
    }

    return clientsController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      return await client.update(id, {
        name: name.trim(),
        phone: phone?.trim() || null,
        direccion: direccion?.trim() || null,
        description: description?.trim() || null,
        total_orders: total_orders || 0,
        location: location || null,
        description_location: description_location?.trim() || null,
        ...(activeValue !== undefined ? { is_active: activeValue } : {})
      });
    }, {
      validateClientId: true,
      checkPermission: 'update',
      successMessage: 'Cliente actualizado exitosamente'
    });
  }

  // Actualizar múltiples clientes en lote
  static async bulkUpdate(req, res) {
    const { clientesData } = req.body;
    const branchId = req.query.branch_id || req.query.sucu_id || req.body.branch_id || req.body.sucu_id;

    if (!clientesData || !Array.isArray(clientesData) || clientesData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren los datos de los clientes'
      });
    }

    return clientsController._handleRequest(res, 'bulkUpdate', req, async () => {
      const resultado = await client.bulkUpdate(clientesData, branchId);
      return resultado.data;
    }, {
      validateSucuId: true,
      checkPermission: 'update',
      successMessage: 'Clientes actualizados exitosamente'
    });
  }

  // Actualizar únicamente location y description_location de un cliente
  static async updateLocation(req, res) {
    const { location, description_location } = req.body;

    if (!location) {
      return res.status(400).json({
        success: false,
        message: 'La ubicación es obligatoria'
      });
    }

    return clientsController._handleRequest(res, 'updateLocation', req, async () => {
      const { id } = req.params;
      return await client.updateLocation(id, location, description_location);
    }, {
      validateClientId: true,
      successMessage: 'Ubicación del cliente registrada exitosamente'
    });
  }

  // Obtener un cliente por ID
  static async getById(req, res) {
    return clientsController._handleRequest(res, 'getById', req, async () => {
      const { id } = req.params;
      return await client.getById(id);
    }, {
      validateClientId: true,
      successMessage: 'Cliente obtenido exitosamente'
    });
  }

  // Buscar ubicaciones en Bolivia mediante OpenStreetMap Nominatim
  static async geocodeSearch(req, res) {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ success: true, data: [] });
    }
    try {
      const axios = require('axios');
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          format: 'jsonv2',
          addressdetails: 1,
          countrycodes: 'bo',
          limit: 8,
          'accept-language': 'es',
          q
        },
        headers: {
          'User-Agent': 'TotalProd-Bolivia-ERP/1.0',
          'Accept-Language': 'es'
        },
        timeout: 6000
      });
      return res.json({ success: true, data: response.data || [] });
    } catch (error) {
      return res.status(502).json({ success: false, message: 'No se pudo consultar el servicio de mapas' });
    }
  }

  // Geocodificación inversa (coordenadas -> calle, ciudad, país)
  static async geocodeReverse(req, res) {
    const { lat, lng } = req.query;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Coordenadas requeridas' });
    }
    try {
      const axios = require('axios');
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'jsonv2',
          lat,
          lon: lng,
          zoom: 18,
          addressdetails: 1,
          'accept-language': 'es'
        },
        headers: {
          'User-Agent': 'TotalProd-Bolivia-ERP/1.0',
          'Accept-Language': 'es'
        },
        timeout: 6000
      });
      return res.json({ success: true, data: response.data || null });
    } catch (error) {
      return res.status(502).json({ success: false, message: 'No se pudo obtener la dirección' });
    }
  }
}

module.exports = clientsController;