const movimientosAcopio = require('../models/movimientosAcopio');
const productsAcopio = require('../models/productsAcopio');
const { checkDeletePermission, checkAnularPermission } = require('../utils/permissionsHelper');
const { supabase } = require('../config/supabase');

class movimientosAcopioController {
  // Crear un movimiento
  static async create(req, res) {
    try {
      const { product_id, type, observations, cliente_id, quantity, restar_materia_prima, restar_ingredientes, sucu_id, personal_id, ingredientes_cantidades_personalizadas, registrar_gasto, costo, metodo_pago, proveedor_id } = req.body;
      const userId = req.user?.id;
      const userType = req.user?.type;

      // Si es empleado, usar personal_id, si es usuario normal, usar userId
      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? personal_id : null;

      if (!finalUserId && !finalPersonalId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado o personal no válido'
        });
      }

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'El ID de la sucursal es requerido'
        });
      }

      // VALIDAR INGREDIENTES ANTES de crear el movimiento si es entrada con restar_materia_prima
      console.log('🔍 DEBUG - Validando ingredientes acopio:', { type, restar_materia_prima, product_id });
      let producto = null;
      let receta = null;
      
      if (type === 'entrada' && restar_materia_prima) {
        try {
          // Obtener producto con receta e ingredientes
          producto = await productsAcopio.getById(product_id, req.user.empresa_id);
          
          if (producto && producto.recetas_acopio && producto.recetas_acopio.length > 0) {
            receta = producto.recetas_acopio[0];
            
            if (receta && receta.recetas_acopio_detalle && receta.recetas_acopio_detalle.length > 0) {
              // VALIDAR stock de ingredientes ANTES de crear el movimiento (solo validación, no resta)
              const validacionIngredientes = await movimientosAcopio.validarStockIngredientes(
                parseFloat(quantity), 
                receta.recetas_acopio_detalle,
                ingredientes_cantidades_personalizadas
              );
              
              // Si la validación falla, retornar error sin crear el movimiento
              if (!validacionIngredientes.success) {
                return res.status(400).json({
                  success: false,
                  message: validacionIngredientes.message,
                  ingredientesConStockInsuficiente: validacionIngredientes.ingredientesConStockInsuficiente
                });
              }
            }
          }
        } catch (error) {
          console.error('Error validando ingredientes acopio:', error);
          return res.status(400).json({
            success: false,
            message: 'Error al validar el stock de ingredientes: ' + error.message
          });
        }
      }

      // Crear el movimiento principal PRIMERO (solo si la validación de ingredientes pasó)
      const newMovimiento = await movimientosAcopio.create({
        product_id,
        type,
        observations,
        cliente_id,
        quantity,
        restar_ingredientes: restar_ingredientes || restar_materia_prima || false,
        sucu_id
      }, finalUserId, finalPersonalId);

      // DESPUÉS de crear el movimiento, restar ingredientes y crear salidas asociadas
      if (type === 'entrada' && restar_materia_prima && producto && receta && receta.recetas_acopio_detalle && receta.recetas_acopio_detalle.length > 0) {
        try {
          const resultadoRestar = await movimientosAcopio.restarIngredientes(
            producto, 
            parseFloat(quantity), 
            receta.recetas_acopio_detalle,
            req.user.empresa_id,
            ingredientes_cantidades_personalizadas,
            sucu_id,
            finalUserId,
            finalPersonalId,
            newMovimiento.id // Pasar el ID del movimiento de entrada creado
          );
          
          // Si falla al restar ingredientes, intentar revertir el movimiento creado
          if (!resultadoRestar.success) {
            // Intentar eliminar el movimiento creado
            try {
              await supabase
                .from('movimientos_acopio')
                .delete()
                .eq('id', newMovimiento.id);
            } catch (deleteError) {
              console.error('Error al revertir movimiento después de fallo en restar ingredientes:', deleteError);
            }
            
            return res.status(400).json({
              success: false,
              message: resultadoRestar.message,
              ingredientesConStockInsuficiente: resultadoRestar.ingredientesConStockInsuficiente
            });
          }
        } catch (error) {
          console.error('Error al restar ingredientes después de crear movimiento:', error);
          // Intentar revertir el movimiento creado
          try {
            await supabase
              .from('movimientos_acopio')
              .delete()
              .eq('id', newMovimiento.id);
          } catch (deleteError) {
            console.error('Error al revertir movimiento después de error en restar ingredientes:', deleteError);
          }
          
          return res.status(400).json({
            success: false,
            message: 'Error al restar ingredientes: ' + error.message
          });
        }
      }

      // Registrar gasto si aplica
      if (registrar_gasto && type === 'entrada') {
        try {
          const d = new Date();
          const getDateStr = () => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
          
          const gastoData = {
            fecha_gasto: getDateStr(),
            valor: parseFloat(costo) || 0,
            concepto: observations?.trim() || 'Pago de Entrada de Materia Prima',
            metodo_pago: metodo_pago || 'efectivo',
            proveedor_id: proveedor_id || null,
            movimiento_acopio_entrada_id: newMovimiento.id,
            sucu_id: sucu_id,
            user_id: finalUserId,
            personal_id: finalPersonalId
          };
          
          const gastosModel = require('../main/pagos/gastos');
          await gastosModel.create(gastoData, finalUserId, req.user?.empresa_id, finalPersonalId, sucu_id);
        } catch (gastoError) {
          console.error('Error al registrar gasto asociado al movimiento de acopio:', gastoError);
          // Opcionalmente se podría revertir, pero mantenemos el comportamiento anterior (warning)
          // por simplicidad si la lógica principal ya funcionó.
        }
      }

      res.status(201).json({
        success: true,
        message: 'Movimiento creado correctamente',
        data: newMovimiento
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener movimientos por producto
  static async getByProduct(req, res) {
    try {
      const { productId } = req.params;
      const { sucu_id } = req.query;

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'El ID de la sucursal es requerido'
        });
      }

      const movimientos = await movimientosAcopio.getByProduct(productId, sucu_id);

      res.json({
        success: true,
        data: movimientos
      });
    } catch (error) {
      console.error('Error en getByProduct:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener movimientos por cliente
  static async getByCliente(req, res) {
    try {
      const { clienteId } = req.params;
      const { sucu_id } = req.query;

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'El ID de la sucursal es requerido'
        });
      }

      const movimientos = await movimientosAcopio.getByCliente(clienteId, sucu_id);

      res.json({
        success: true,
        data: movimientos
      });
    } catch (error) {
      console.error('Error en getByCliente:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener movimientos por proveedor
  static async getByProveedor(req, res) {
    try {
      const { proveedorId } = req.params;
      const { sucu_id } = req.query;

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'El ID de la sucursal es requerido'
        });
      }

      const movimientos = await movimientosAcopio.getByProveedor(proveedorId, sucu_id);

      res.json({
        success: true,
        data: movimientos
      });
    } catch (error) {
      console.error('Error en getByProveedor:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener todos los movimientos
  static async getAll(req, res) {
    try {
      const { page = 1, limit = 10, tipo, estado, ordenamiento = 'fecha_desc', sucu_id, search = null, cliente = null } = req.query;
      
      // Extraer filtro de fecha
      let filtroFecha = null;
      if (req.query.fecha_inicio || req.query.fecha_fin) {
        filtroFecha = {
          inicio: req.query.fecha_inicio || null,
          fin: req.query.fecha_fin || null
        };
      }
      
      console.log('[MovAcopioCtrl.getAll] params =>', { sucu_id, page, limit, tipo, estado, ordenamiento, search, cliente, filtroFecha });

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'El ID de la sucursal es requerido'
        });
      }

      const result = await movimientosAcopio.getAll(sucu_id, parseInt(page), parseInt(limit), tipo, estado, ordenamiento, search, cliente, filtroFecha);
      console.log('[MovAcopioCtrl.getAll] result =>', { success: result?.success, dataLen: result?.data?.length, pagination: result?.pagination });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.message || 'Error interno del servidor'
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Anular un movimiento
  static async anular(req, res) {
    try {
      const { id } = req.params;
      const userType = req.user?.type;

      // Verificar permisos de anulación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkAnularPermission(personal_id);
        
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para anular movimientos'
          });
        }
      }

      // Eliminar gastos asociados automáticamente
      const { data: gastosRelacionados } = await require('../config/supabase').supabase
        .from('gastos')
        .select('id')
        .eq('movimiento_acopio_entrada_id', id);

      if (gastosRelacionados && gastosRelacionados.length > 0) {
        const gastosModel = require('../main/pagos/gastos');
        for (const gasto of gastosRelacionados) {
          await gastosModel.delete(gasto.id);
        }
      }

      const result = await movimientosAcopio.anular(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
        pedidoActualizado: result.pedidoActualizado,
        salidasEliminadas: result.salidasEliminadas || []
      });
    } catch (error) {
      console.error('Error en anular:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Eliminar un movimiento
  static async eliminar(req, res) {
    try {
      const { id } = req.params;
      const userType = req.user?.type;

      // Verificar permisos de eliminación solo si es empleado
      if (userType === 'employee') {
        const personal_id = req.user.id; // El personal_id viene del token

        const hasPermission = await checkDeletePermission(personal_id);
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: 'No tienes permisos para eliminar movimientos'
          });
        }
      }

      const result = await movimientosAcopio.eliminar(id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: 'Movimiento eliminado correctamente'
      });
    } catch (error) {
      console.error('Error en eliminar:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Obtener un movimiento por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'El ID del movimiento es requerido'
        });
      }

      const movimiento = await movimientosAcopio.getById(id);

      return res.status(200).json({
        success: true,
        data: movimiento
      });

    } catch (error) {
      console.error('Error en getById:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = movimientosAcopioController;