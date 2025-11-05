const movimientosAcopio = require('../models/movimientosAcopio');
const productsAcopio = require('../models/productsAcopio');
const { checkDeletePermission, checkAnularPermission } = require('../utils/permissionsHelper');
const { supabase } = require('../config/supabase');

class movimientosAcopioController {
  // Crear un movimiento
  static async create(req, res) {
    try {
      const { product_id, type, observations, proveedor_id, cliente_id, quantity, costo, metodo_pago, gasto_id, restar_materia_prima, restar_ingredientes, sucu_id, personal_id, ingredientes_cantidades_personalizadas } = req.body;
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
          message: 'ID de la sucursal es requerido'
        });
      }

      // Obtener producto con receta e ingredientes ANTES de crear el movimiento para validación
      let producto = null;
      let receta = null;
      if (type === 'entrada' && restar_materia_prima) {
        try {
          producto = await productsAcopio.getById(product_id, req.user.empresa_id);
          
          if (producto && producto.recetas_acopio && producto.recetas_acopio.length > 0) {
            receta = producto.recetas_acopio[0];
            
            if (receta && receta.recetas_acopio_detalle && receta.recetas_acopio_detalle.length > 0) {
              // VALIDAR stock de ingredientes ANTES de crear el movimiento (solo validación, no ejecuta)
              // Llamamos a restarIngredientes con un flag de solo validación o mejor, creamos una función separada
              // Por ahora, validamos llamando a restarIngredientes pero esto necesita ajuste
              // Mejor: crear el movimiento primero y luego ejecutar restarIngredientes con el ID
              // Por simplicidad, validamos stock primero
              const ingredienteIds = receta.recetas_acopio_detalle
                .filter(ing => ing.products_acopio && ing.products_acopio.id)
                .map(ing => ing.products_acopio.id);
              
              if (ingredienteIds.length > 0) {
                const { data: productosActuales, error: fetchError } = await supabase
                  .from('products_acopio')
                  .select('id, quantity, name')
                  .in('id', ingredienteIds);
                
                if (!fetchError && productosActuales) {
                  const stocksActuales = {};
                  productosActuales.forEach(p => { stocksActuales[p.id] = p.quantity; });
                  
                  const ingredientesConStockInsuficiente = [];
                  for (let i = 0; i < receta.recetas_acopio_detalle.length; i++) {
                    const detalle = receta.recetas_acopio_detalle[i];
                    if (!detalle.products_acopio || !detalle.products_acopio.id) continue;
                    
                    let cantidadARestar;
                    // Verificar si hay cantidad personalizada (las keys pueden ser strings o números)
                    const cantidadPersonalizada = ingredientes_cantidades_personalizadas?.[i] ?? ingredientes_cantidades_personalizadas?.[String(i)];
                    if (cantidadPersonalizada !== undefined && cantidadPersonalizada !== null) {
                      cantidadARestar = parseFloat(cantidadPersonalizada);
                    } else {
                      cantidadARestar = detalle.cantidad * parseFloat(quantity);
                    }
                    
                    const cantidadActual = stocksActuales[detalle.products_acopio.id] || 0;
                    if (cantidadActual < cantidadARestar) {
                      ingredientesConStockInsuficiente.push({
                        nombre: productosActuales.find(p => p.id === detalle.products_acopio.id)?.name || 'Desconocido',
                        stockActual: cantidadActual,
                        requerido: cantidadARestar
                      });
                    }
                  }
                  
                  if (ingredientesConStockInsuficiente.length > 0) {
                    const mensajeError = ingredientesConStockInsuficiente.map(ing => 
                      `${ing.nombre}: Stock actual ${ing.stockActual}, requerido ${ing.requerido}`
                    ).join('; ');
                    
                    return res.status(400).json({
                      success: false,
                      message: `Stock insuficiente de ingredientes: ${mensajeError}`,
                      ingredientesConStockInsuficiente
                    });
                  }
                }
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

      // Crear el movimiento principal PRIMERO (para tener el ID)
      const newMovimiento = await movimientosAcopio.create({
        product_id,
        type,
        observations,
        proveedor_id,
        cliente_id,
        quantity,
        costo,
        metodo_pago,
        gasto_id,
        restar_ingredientes: restar_ingredientes || false,
        sucu_id
      }, finalUserId, finalPersonalId);

      // EJECUTAR restarIngredientes DESPUÉS de crear el movimiento (para tener el ID)
      if (type === 'entrada' && restar_materia_prima && producto && receta && receta.recetas_acopio_detalle && receta.recetas_acopio_detalle.length > 0) {
        try {
          const resultadoIngredientes = await movimientosAcopio.restarIngredientes(
            producto, 
            parseFloat(quantity), 
            receta.recetas_acopio_detalle,
            req.user.empresa_id,
            ingredientes_cantidades_personalizadas,
            sucu_id,
            finalUserId,
            finalPersonalId,
            newMovimiento.id // Pasar el ID del movimiento de entrada recién creado
          );
          
          // Si falla al ejecutar (aunque ya validamos antes), hacer rollback
          if (!resultadoIngredientes.success) {
            // Intentar eliminar el movimiento creado
            try {
              await movimientosAcopio.eliminar(newMovimiento.id);
            } catch (rollbackError) {
              console.error('Error en rollback del movimiento:', rollbackError);
            }
            
            return res.status(400).json({
              success: false,
              message: resultadoIngredientes.message,
              ingredientesConStockInsuficiente: resultadoIngredientes.ingredientesConStockInsuficiente
            });
          }
        } catch (error) {
          console.error('Error ejecutando restarIngredientes:', error);
          // Intentar rollback
          try {
            await movimientosAcopio.eliminar(newMovimiento.id);
          } catch (rollbackError) {
            console.error('Error en rollback del movimiento:', rollbackError);
          }
          
          return res.status(400).json({
            success: false,
            message: 'Error al procesar ingredientes: ' + error.message
          });
        }
      }

      res.status(201).json({
        success: true,
        message: 'Movimiento creado exitosamente',
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
          message: 'ID de la sucursal es requerido'
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
          message: 'ID de la sucursal es requerido'
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
          message: 'ID de la sucursal es requerido'
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
      const { page = 1, limit = 10, tipo, estado, ordenamiento = 'fecha_desc', sucu_id, search = null } = req.query;
      console.log('[MovAcopioCtrl.getAll] params =>', { sucu_id, page, limit, tipo, estado, ordenamiento, search });

      if (!sucu_id) {
        return res.status(400).json({
          success: false,
          message: 'ID de la sucursal es requerido'
        });
      }

      const result = await movimientosAcopio.getAll(sucu_id, parseInt(page), parseInt(limit), tipo, estado, ordenamiento, search);
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
        salidasEliminadas: result.salidasEliminadas || null
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
          message: 'ID del movimiento es requerido'
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