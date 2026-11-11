const { supabase } = require('../../config/supabase');

class clients {

  // Constructor para crear un cliente
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.phone = data.phone;
    this.location = data.location;
    this.description_location = data.description_location;
    this.description = data.description;
    this.total_orders = data.total_orders;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.created_at = data.created_at;
    this.branch_id = data.branch_id || data.sucu_id;
  }

  static _parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'false' || value === '0' || value === 0 || value === 'inactivo') return false;
    if (value === 'true' || value === '1' || value === 1 || value === 'activo') return true;
    return Boolean(value);
  }

  static _formatPoint(location) {
    if (!location) return null;
    if (typeof location === 'object') {
      const lat = location.x ?? location.lat;
      const lng = location.y ?? location.lng;
      if (lat !== undefined && lng !== undefined) {
        return `(${lat},${lng})`;
      }
      return null;
    }
    const clean = String(location).trim().replace(/[()]/g, '');
    const parts = clean.split(',').map((p) => p.trim());
    if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
      return `(${parts[0]},${parts[1]})`;
    }
    return String(location);
  }

  // Método para obtener todos los clientes de una sucursal
  static async getAll(branchId, isActive = null) {
    try {
      if (!branchId) {
        throw new Error('ID de la sucursal es requerido');
      }

      let query = supabase
        .from('clients')
        .select('*')
        .eq('branch_id', branchId);

      if (isActive !== null && isActive !== undefined && isActive !== '') {
        if (isActive === true || isActive === 'true' || isActive === '1' || isActive === 1 || isActive === 'activo') {
          query = query.eq('is_active', true);
        } else if (isActive === false || isActive === 'false' || isActive === '0' || isActive === 0 || isActive === 'inactivo') {
          query = query.eq('is_active', false);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error de Supabase en clients.getAll:', error);
        throw new Error(`No se pudo obtener los clientes: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      throw new Error('No se pudo obtener los clientes');
    }
  }

  // Crear un cliente
  static async create(clientData, branchId) {
    try {
      
      // Preparar datos para la base de datos
      const activeInput = clientData.is_active !== undefined ? clientData.is_active : clientData.status;
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        description: clientData.description || null,
        total_orders: clientData.total_orders || 0,
        location: clients._formatPoint(clientData.location),
        description_location: clientData.description_location || null,
        is_active: activeInput !== undefined ? clients._parseBoolean(activeInput) : true,
        branch_id: branchId,
      };

      const { data, error } = await supabase
        .from('clients')
        .insert([dbData])
        .select();

      if (error) {
        throw new Error('No se pudo crear el cliente');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo crear el cliente');
      }
    } catch (error) {
      throw error;
    }
  }

  // Eliminar un cliente
  static async delete(id) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id)

      if (error) {
        if (error.code === '23503' || (error.message && error.message.includes('foreign key'))) {
          throw new Error('No es posible eliminar el cliente porque está asociado a registros de movimientos o deudas existentes.');
        }
        throw new Error('No se pudo eliminar el cliente');
      }

      return true;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar un cliente
  static async update(id, clientData) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      // Preparar datos para la base de datos
      const activeInput = clientData.is_active !== undefined ? clientData.is_active : clientData.status;
      const dbData = {
        name: clientData.name,
        phone: clientData.phone || null,
        description: clientData.description || null,
        total_orders: clientData.total_orders || 0,
        location: clients._formatPoint(clientData.location),
        description_location: clientData.description_location || null,
        ...(activeInput !== undefined ? { is_active: clients._parseBoolean(activeInput) } : {})
      };

      const { data, error } = await supabase
        .from('clients')
        .update(dbData)
        .eq('id', id)
        .select();

      if (error) {
        throw new Error('No se pudo actualizar el cliente');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo actualizar el cliente');
      }
    } catch (error) {
      throw error;
    }
  }

  // Actualizar múltiples clientes en lote (bulk update por ID)
  static async bulkUpdate(clientesData, branchId = null) {
    try {
      if (!Array.isArray(clientesData) || clientesData.length === 0) {
        throw new Error('Array de clientes es requerido');
      }

      const resultados = {
        actualizados: 0,
        clientes: [],
        errores: [],
        total: clientesData.length
      };

      const BATCH_SIZE = 10;
      const batches = [];

      for (let i = 0; i < clientesData.length; i += BATCH_SIZE) {
        batches.push(clientesData.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (clienteData) => {
          try {
            const { id, name, phone, description, total_orders, location, description_location } = clienteData;

            if (!id || !String(id).trim()) {
              throw new Error('ID del cliente es requerido');
            }

            if (!name || !String(name).trim()) {
              throw new Error('El nombre del cliente no puede estar vacío');
            }

            const parsedOrders = total_orders !== undefined && total_orders !== null && String(total_orders).trim() !== ''
              ? parseInt(total_orders, 10)
              : 0;

            const dbData = {
              name: String(name).trim(),
              phone: phone !== undefined && phone !== null && String(phone).trim() !== '' ? String(phone).trim() : null,
              description: description !== undefined && description !== null && String(description).trim() !== '' ? String(description).trim() : null,
              total_orders: isNaN(parsedOrders) ? 0 : parsedOrders,
              location: clients._formatPoint(location),
              description_location: description_location !== undefined && description_location !== null && String(description_location).trim() !== '' ? String(description_location).trim() : null
            };

            let query = supabase
              .from('clients')
              .update(dbData)
              .eq('id', String(id).trim());

            if (branchId) {
              query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query.select();

            if (error) {
              throw new Error(`Error actualizando cliente ${id}: ${error.message}`);
            }

            if (data && data.length > 0) {
              resultados.actualizados++;
              resultados.clientes.push(data[0]);
              return { success: true, id, data: data[0] };
            } else {
              throw new Error(`Cliente ${id} no encontrado`);
            }
          } catch (error) {
            const errorMsg = `Cliente ${clienteData.id || 'desconocido'}: ${error.message}`;
            resultados.errores.push(errorMsg);
            return { success: false, id: clienteData.id, error: errorMsg };
          }
        });

        await Promise.allSettled(batchPromises);
      }

      return {
        success: true,
        data: resultados,
        message: `Actualización completada: ${resultados.actualizados}/${resultados.total} clientes actualizados`
      };
    } catch (error) {
      throw error;
    }
  }

  // Insertar/actualizar únicamente la ubicación (location y description_location) de un cliente
  static async updateLocation(id, location, descriptionLocation) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      const dbData = {
        location: clients._formatPoint(location),
        description_location: descriptionLocation ? String(descriptionLocation).trim() : null
      };

      const { data, error } = await supabase
        .from('clients')
        .update(dbData)
        .eq('id', id)
        .select();

      if (error) {
        throw new Error('No se pudo registrar la ubicación del cliente');
      }

      if (data && data.length > 0) {
        return data[0];
      } else {
        throw new Error('No se pudo registrar la ubicación del cliente');
      }
    } catch (error) {
      throw error;
    }
  }

  // Obtener un cliente por ID
  static async getById(id) {
    try {
      if (!id) {
        throw new Error('ID del cliente es requerido');
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        throw new Error('No se pudo obtener el cliente');
      }

      if (!data) {
        throw new Error('Cliente no encontrado');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = clients;