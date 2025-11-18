const deudas = require('../models/deudas');
const { checkDeletePermission, checkUpdatePermission } = require('../utils/permissionsHelper');

class deudasController {

  // Obtener todas las deudas con paginación
  static async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', estado = null, cliente_id = null, ordenamiento = 'fecha_desc', sucu_id } = req.query;
      
      // Extraer filtro de fecha
      let filtroFecha = null;
      if (req.query.fecha_inicio || req.query.fecha_fin) {
        filtroFecha = {
          inicio: req.query.fecha_inicio || null,
          fin: req.query.fecha_fin || null
        };
      }
      
      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const result = await deudas.getAll(
        parseInt(page), 
        parseInt(limit), 
        search,
        estado,
        cliente_id,
        ordenamiento, 
        sucu_id,
        filtroFecha
      );
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getAll deudas:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener las deudas'
      });
    }
  }


  // Obtener una deuda por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la deuda es requerido'
        });
      }

      const result = await deudas.getById(id);
      
      if (!result.success) {
        return res.status(404).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getById deuda:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener la deuda'
      });
    }
  }

  // Crear una nueva deuda
  static async create(req, res) {
    try {
      const { sucu_id, personal_id, fecha_deuda, fecha_vencimiento, monto_total, concepto, cliente_id, movimiento_salida_id, destino_sucursal_id } = req.body;
      const user_id = req.user?.id;
      const userType = req.user?.type; // Verificar si es empleado o usuario normal

      // Si es empleado, usar personal_id, si es usuario normal, usar user_id
      const finalUserId = userType === 'employee' ? null : user_id;
      const finalPersonalId = userType === 'employee' ? personal_id : null;

      if (!finalUserId && !finalPersonalId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Validaciones básicas
      if (!monto_total || monto_total <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El monto total es obligatorio y debe ser mayor a 0'
        });
      }

      if (!concepto || !concepto.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El concepto es obligatorio'
        });
      }

      if (!fecha_vencimiento) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de vencimiento es obligatoria'
        });
      }

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      // El movimiento de salida asociado es opcional

      const deudaData = {
        user_id: finalUserId,
        personal_id: finalPersonalId,
        sucu_id,
        fecha_vencimiento,
        monto_total: parseFloat(monto_total),
        concepto: concepto.trim(),
        cliente_id: cliente_id || null,
        movimiento_salida_id,
        destino_sucursal_id: destino_sucursal_id || null
      };

      if (fecha_deuda) {
        deudaData.fecha_deuda = fecha_deuda;
      }

      const result = await deudas.create(deudaData);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error en create deuda:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al crear la deuda'
      });
    }
  }

  // Actualizar una deuda
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { fecha_deuda, fecha_vencimiento, monto_total, saldo_pendiente, concepto, estado, cliente_id } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la deuda es requerido'
        });
      }

      // Validaciones básicas
      if (monto_total !== undefined && monto_total <= 0) {
        return res.status(400).json({
          success: false,
          message: 'El monto total debe ser mayor a 0'
        });
      }

      if (concepto !== undefined && !concepto.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El concepto es obligatorio'
        });
      }

      if (saldo_pendiente !== undefined && saldo_pendiente < 0) {
        return res.status(400).json({
          success: false,
          message: 'El saldo pendiente no puede ser negativo'
        });
      }

      const updateData = {
        fecha_vencimiento,
        monto_total: monto_total !== undefined ? parseFloat(monto_total) : undefined,
        saldo_pendiente: saldo_pendiente !== undefined ? parseFloat(saldo_pendiente) : undefined,
        concepto: concepto !== undefined ? concepto.trim() : undefined,
        estado,
        cliente_id: cliente_id !== undefined ? (cliente_id || null) : undefined
      };

      if (fecha_deuda !== undefined) {
        updateData.fecha_deuda = fecha_deuda;
      }

      if (updateData.monto_total !== undefined && updateData.saldo_pendiente === undefined) {
        updateData.saldo_pendiente = updateData.monto_total;
      }

      // Verificar permisos de actualización solo si es empleado
      const userType = req.user?.type;
      
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token
        
        const hasPermission = await checkUpdatePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para actualizar deudas'
          });
        }
      }

      const result = await deudas.update(id, updateData);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en update deuda:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar la deuda'
      });
    }
  }

  // Eliminar una deuda
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la deuda es requerido'
        });
      }

      // Verificar permisos de eliminación solo si es empleado
      const userType = req.user?.type;
      
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token
        
        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar deudas'
          });
        }
      }

      const result = await deudas.delete(id);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en delete deuda:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al eliminar la deuda'
      });
    }
  }

  // Eliminar deudas por movimiento_salida_id
  static async deleteByMovimientoSalidaId(req, res) {
    try {
      const { movimiento_salida_id } = req.params;

      if (!movimiento_salida_id) {
        return res.status(400).json({
          success: false,
          message: 'ID del movimiento de salida es requerido'
        });
      }

      const result = await deudas.deleteByMovimientoSalidaId(movimiento_salida_id);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en deleteByMovimientoSalidaId:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al eliminar las deudas asociadas al movimiento'
      });
    }
  }

  // Obtener deudas por rango de fechas
  static async getByDateRange(req, res) {
    try {
      const { fechaInicio, fechaFin, sucu_id } = req.query;
      const { sucu_id: userSucuId } = req.user;

      const sucuId = sucu_id || userSucuId;
      
      if (!sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      if (!fechaInicio || !fechaFin) {
        return res.status(400).json({
          success: false,
          message: 'Las fechas de inicio y fin son requeridas'
        });
      }

      const result = await deudas.getByDateRange(fechaInicio, fechaFin, sucuId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getByDateRange deudas:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener las deudas'
      });
    }
  }

  // Actualizar estado de una deuda
  static async updateEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado, saldo_pendiente } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la deuda es requerido'
        });
      }

      if (!estado) {
        return res.status(400).json({
          success: false,
          message: 'El estado es requerido'
        });
      }

      const estadosValidos = ['pendiente', 'pagada', 'vencida'];
      if (!estadosValidos.includes(estado)) {
        return res.status(400).json({
          success: false,
          message: 'Estado no válido. Debe ser: pendiente, pagada o vencida'
        });
      }

      const result = await deudas.updateEstado(id, estado, saldo_pendiente);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en updateEstado deuda:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar el estado de la deuda'
      });
    }
  }

  // Obtener deudas vencidas
  static async getDeudasVencidas(req, res) {
    try {
      const { sucu_id } = req.query;
      const { sucu_id: userSucuId } = req.user;

      const sucuId = sucu_id || userSucuId;
      
      if (!sucuId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const result = await deudas.getDeudasVencidas(sucuId);
      
      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getDeudasVencidas:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener las deudas vencidas'
      });
    }
  }

  // Crear pago parcial
  static async createPagoParcial(req, res) {
    try {
      const { id } = req.params; // deuda id
      const { monto, fecha } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, message: 'ID de la deuda es requerido' });
      }
      if (!monto || monto <= 0) {
        return res.status(400).json({ success: false, message: 'El monto es obligatorio y debe ser mayor a 0' });
      }

      const userType = req.user?.type;
      const user_id = userType === 'employee' ? null : req.user?.id;
      const personal_id = userType === 'employee' ? req.user?.id : null;

      const result = await deudas.createPagoParcial({ deuda_id: id, monto: parseFloat(monto), fecha, user_id, personal_id });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error en createPagoParcial:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al registrar el pago parcial' });
    }
  }

  // Listar pagos parciales de una deuda
  static async getPagosParciales(req, res) {
    try {
      const { id } = req.params; // deuda id
      if (!id) {
        return res.status(400).json({ success: false, message: 'ID de la deuda es requerido' });
      }

      const result = await deudas.getPagosParciales(id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('Error en getPagosParciales:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al obtener los pagos parciales' });
    }
  }

  // Eliminar un pago parcial
  static async deletePagoParcial(req, res) {
    try {
      const { id, pago_id } = req.params; // deuda id y pago id
      if (!id || !pago_id) {
        return res.status(400).json({ success: false, message: 'IDs requeridos' });
      }

      const result = await deudas.deletePagoParcial(id, pago_id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.status(200).json(result);
    } catch (error) {
      console.error('Error en deletePagoParcial:', error);
      res.status(500).json({ success: false, message: error.message || 'Error al eliminar el pago parcial' });
    }
  }
}

module.exports = deudasController;
