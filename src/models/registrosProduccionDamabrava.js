const { supabase } = require('../config/supabase');
const productsAlmacen = require('./productsAlmacen');
const movimientosAlmacen = require('./movimientosAlmacen');

class registrosProduccionDamabrava {
    // Crear un nuevo registro de producción
    static async create(registroData) {
        try {
            const { 
                user_id, 
                personal_id, 
                producto_almacen_id, 
                lote, 
                proceso, 
                microondas, 
                terminados, 
                vencimiento, 
                sucursal_id,
                observaciones,
                empresa_id 
            } = registroData;

            // Crear timestamp en zona horaria de Bolivia (GMT-4) - OPTIMIZADO
            const ahora = new Date();
            const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));

            // VALIDAR Y RESTAR INGREDIENTES ANTES de crear el registro
            if (empresa_id) {
                try {
                    // Obtener el producto con sus recetas
                    const producto = await productsAlmacen.getById(producto_almacen_id, empresa_id);
                    
                    if (producto && producto.recetas && producto.recetas.length > 0) {
                        const receta = producto.recetas[0];
                        
                        if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {

                            // Usar la función existente de movimientosAlmacen
                            const resultadoIngredientes = await movimientosAlmacen.restarIngredientes(
                                producto,
                                parseFloat(terminados),
                                receta.recetas_detalle,
                                empresa_id
                            );
                            
                            
                            // Si la validación falla, retornar error sin crear el registro
                            if (!resultadoIngredientes.success) {
                                return {
                                    success: false,
                                    message: resultadoIngredientes.message,
                                    ingredientesConStockInsuficiente: resultadoIngredientes.ingredientesConStockInsuficiente
                                };
                            }
                            
                        } else {
                        }
                    } else {
                    }
                } catch (error) {
                    return {
                        success: false,
                        message: 'Error al validar el stock de ingredientes: ' + error.message
                    };
                }
            } else {
            }

            // Preparar datos para insertar
            const insertData = {
                producto_almacen_id,
                lote: parseFloat(lote),
                proceso,
                microondas: parseFloat(microondas),
                terminados: parseFloat(terminados),
                vencimiento,
                sucursal_id,
                observaciones: observaciones || null,
                estado: 'pendiente', // Estado por defecto
                fecha: ahoraBolivia.toISOString() // Usar timestamp en zona horaria de Bolivia
            };

            // Solo agregar user_id o personal_id si tienen valor
            // IMPORTANTE: No enviar campos null para evitar problemas de foreign key
            if (user_id && user_id !== null) {
                insertData.user_id = user_id;
            }
            if (personal_id && personal_id !== null) {
                insertData.personal_id = personal_id;
            }

            // Insertar el registro
            const { data: registro, error: registroError } = await supabase
                .from('registros_produccion_damabrava')
                .insert(insertData)
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description
                    ),
                    sucursal:sucursal_id(
                        id,
                        name
                    )
                `)
                .single();

            if (registroError) {
                return { 
                    success: false, 
                    message: 'Error al crear el registro de producción', 
                    error: registroError 
                };
            }

            // Obtener información del usuario o personal que registró
            let user = null;
            let personal = null;

            // Si tiene user_id, obtener el usuario
            if (registro.user_id) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', registro.user_id)
                    .single();
                
                if (!userError && userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            // Si tiene personal_id, obtener el personal
            if (registro.personal_id) {
                const { data: personalData, error: personalError } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', registro.personal_id)
                    .single();
                
                if (!personalError && personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            return { 
                success: true, 
                message: 'Registro de producción creado exitosamente',
                data: {
                    ...registro,
                    user,
                    personal
                }
            };

        } catch (error) {
            return { 
                success: false, 
                message: 'Error interno del servidor', 
                error 
            };
        }
    }

    // Obtener todos los registros de producción (sin filtrar por sucursal)
    static async getAll(page = 1, limit = 10, estado = null, ordenamiento = 'fecha_desc', search = '', responsableId = null, responsableTipo = null) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('registros_produccion_damabrava')
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description
                    ),
                    sucursal:sucursal_id(
                        id,
                        name
                    ),
                    user:user_id(
                        id,
                        first_name,
                        last_name
                    ),
                    personal:personal_id(
                        id,
                        first_name,
                        last_name
                    )
                `, { count: 'exact' });

            // Aplicar filtro de estado si se proporciona
            if (estado) {
                query = query.eq('estado', estado);
            }

            // Aplicar filtro de responsable si se proporciona
            if (responsableId && responsableTipo) {
                if (responsableTipo === 'personal') {
                    query = query.eq('personal_id', responsableId);
                } else if (responsableTipo === 'usuario') {
                    query = query.eq('user_id', responsableId);
                }
            }

            // Aplicar ordenamiento
            const ascending = ordenamiento === 'fecha_asc';
            query = query.order('fecha', { ascending });

            const { data: registros, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                return { success: false, message: 'Error al obtener registros de producción', error };
            }

            // Si no hay registros, retornar array vacío
            if (!registros || registros.length === 0) {
                return {
                    success: true,
                    data: [],
                    pagination: {
                        total: count || 0,
                        page,
                        limit,
                        hasNextPage: false
                    }
                };
            }

            // Procesar datos de usuario/personal (ya vienen en la consulta)
            const registrosConUsuarios = registros.map(registro => {
                let user = null;
                let personal = null;

                // Procesar usuario si existe
                if (registro.user) {
                    user = {
                        id: registro.user.id,
                        name: `${registro.user.first_name} ${registro.user.last_name}`.trim()
                    };
                }

                // Procesar personal si existe
                if (registro.personal) {
                    personal = {
                        id: registro.personal.id,
                        name: `${registro.personal.first_name} ${registro.personal.last_name}`.trim()
                    };
                }

                return {
                    ...registro,
                    user,
                    personal
                };
            });

            // Aplicar búsqueda por texto si se proporciona
            let registrosFiltrados = registrosConUsuarios;
            if (search && search.trim()) {
                const searchTerm = search.toLowerCase().trim();
                registrosFiltrados = registrosConUsuarios.filter(registro => {
                    // Buscar en nombre del producto
                    const nombreProducto = (registro.producto_almacen?.name || '').toLowerCase();
                    
                    // Buscar en nombre del responsable (usuario o personal)
                    const nombreResponsable = (registro.user?.name || registro.personal?.name || '').toLowerCase();
                    
                    // Buscar en lote (convertir a string)
                    const lote = String(registro.lote || '').toLowerCase();
                    
                    return nombreProducto.includes(searchTerm) || 
                           nombreResponsable.includes(searchTerm) || 
                           lote.includes(searchTerm);
                });
            }

            // Recalcular paginación si hay búsqueda
            const totalFiltrados = registrosFiltrados.length;
            const hasNextPageFiltrado = search ? false : count > offset + limit; // Si hay búsqueda, no hay paginación

            return {
                success: true,
                data: registrosFiltrados,
                pagination: {
                    total: search ? totalFiltrados : count,
                    page,
                    limit,
                    hasNextPage: hasNextPageFiltrado
                }
            };

        } catch (error) {
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Eliminar un registro de producción
    static async delete(registroId) {
        try {
            
            // Verificar que el registro existe
            const { data: registro, error: registroError } = await supabase
                .from('registros_produccion_damabrava')
                .select('id, estado')
                .eq('id', registroId)
                .single();

            if (registroError) {
                return { success: false, message: 'Registro no encontrado' };
            }

            if (!registro) {
                return { success: false, message: 'Registro no encontrado' };
            }


            // PASO 1: DEVOLVER INGREDIENTES PRIMERO
            
            let resultadoIngredientes = { ingredientesDevueltos: [] };
            
            // Obtener el registro con producto y recetas para devolver ingredientes
            const { data: registroCompleto, error: registroCompletoError } = await supabase
                .from('registros_produccion_damabrava')
                .select(`
                    id,
                    terminados,
                    producto_almacen_id,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        recetas(
                            id,
                            descripcion,
                            recetas_detalle(
                                id,
                                cantidad,
                                products_acopio:producto_acopio_id(
                                    id,
                                    name,
                                    quantity
                                )
                            )
                        )
                    )
                `)
                .eq('id', registroId)
                .single();

            if (registroCompleto && registroCompleto.producto_almacen && 
                registroCompleto.producto_almacen.recetas && 
                registroCompleto.producto_almacen.recetas.length > 0) {
                
                const receta = registroCompleto.producto_almacen.recetas[0];
                if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                    // Usar el método existente de movimientosAlmacen
                    resultadoIngredientes = await movimientosAlmacen.devolverIngredientes(
                        registroCompleto.producto_almacen,
                        registroCompleto.terminados,
                        receta.recetas_detalle,
                        null // empresaId no es necesario para devolver
                    );
                    
                    if (!resultadoIngredientes.success) {
                    } else {
                        console.log('✅ [ELIMINAR PRODUCCIÓN] PASO 1 COMPLETADO: Ingredientes devueltos correctamente');
                    }
                } else {
                    console.log('ℹ️ [ELIMINAR PRODUCCIÓN] Producto sin ingredientes, no hay nada que devolver');
                }
            } else {
                console.log('ℹ️ [ELIMINAR PRODUCCIÓN] Producto sin recetas, no hay ingredientes que devolver');
            }

            // PASO 2: ELIMINAR EL REGISTRO DESPUÉS
            console.log('🔍 [ELIMINAR PRODUCCIÓN] PASO 2: Eliminando registro de la base de datos...');
            const { error: deleteError } = await supabase
                .from('registros_produccion_damabrava')
                .delete()
                .eq('id', registroId);

            if (deleteError) {
                console.error('❌ [ELIMINAR PRODUCCIÓN] Error eliminando registro:', deleteError);
                return { success: false, message: 'Error al eliminar el registro' };
            }

            console.log('✅ [ELIMINAR PRODUCCIÓN] PASO 2 COMPLETADO: Registro eliminado correctamente');
            return { 
                success: true, 
                message: 'Registro eliminado correctamente',
                ingredientesDevueltos: resultadoIngredientes.ingredientesDevueltos || []
            };

        } catch (error) {
            console.error('❌ [ELIMINAR PRODUCCIÓN] Error en eliminar registro:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    // Verificar un registro de producción
    static async verify(registroId, verificacionData) {
        try {
            const { cantidad_verificada, observaciones } = verificacionData;

            console.log('🔍 [VERIFICAR PRODUCCIÓN] Iniciando verificación:', {
                registroId,
                cantidad_verificada
            });

            // Crear timestamp en zona horaria de Bolivia (GMT-4) - OPTIMIZADO
            const ahora = new Date();
            const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));

            // Verificar que el registro existe y obtener datos completos
            const { data: registro, error: registroError } = await supabase
                .from('registros_produccion_damabrava')
                .select(`
                    id, 
                    estado, 
                    terminados,
                    producto_almacen_id,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        recetas(
                            id,
                            descripcion,
                            recetas_detalle(
                                id,
                                cantidad,
                                products_acopio:producto_acopio_id(
                                    id,
                                    name,
                                    quantity
                                )
                            )
                        )
                    )
                `)
                .eq('id', registroId)
                .single();

            if (registroError) {
                console.error('❌ [VERIFICAR PRODUCCIÓN] Error obteniendo registro:', registroError);
                return { success: false, message: 'Registro no encontrado' };
            }

            if (!registro) {
                console.log('❌ [VERIFICAR PRODUCCIÓN] Registro no encontrado');
                return { success: false, message: 'Registro no encontrado' };
            }

            if (registro.estado !== 'pendiente') {
                console.log('❌ [VERIFICAR PRODUCCIÓN] Registro no está en estado pendiente:', registro.estado);
                return { success: false, message: 'Solo se pueden verificar registros en estado pendiente' };
            }

            console.log('🔍 [VERIFICAR PRODUCCIÓN] Registro obtenido:', {
                id: registro.id,
                terminados: registro.terminados,
                cantidad_verificada,
                diferencia: parseFloat(cantidad_verificada) - registro.terminados
            });

            // MANEJAR DIFERENCIA ENTRE REGISTRADO Y VERIFICADO
            const cantidadRegistrada = registro.terminados;
            const cantidadVerificada = parseFloat(cantidad_verificada);
            const diferencia = cantidadVerificada - cantidadRegistrada;

            console.log('🔍 [VERIFICAR PRODUCCIÓN] Análisis de diferencia:', {
                cantidadRegistrada,
                cantidadVerificada,
                diferencia,
                tipo: diferencia > 0 ? 'MÁS' : diferencia < 0 ? 'MENOS' : 'IGUAL'
            });

            // Si hay diferencia, ajustar ingredientes
            if (diferencia !== 0 && registro.producto_almacen && 
                registro.producto_almacen.recetas && 
                registro.producto_almacen.recetas.length > 0) {
                
                const receta = registro.producto_almacen.recetas[0];
                if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                    
                    if (diferencia < 0) {
                        // VERIFICÓ MENOS: Devolver ingredientes de la diferencia
                        console.log('🔍 [VERIFICAR PRODUCCIÓN] Verificó MENOS, devolviendo ingredientes de:', Math.abs(diferencia));
                        const resultadoDevolver = await movimientosAlmacen.devolverIngredientes(
                            registro.producto_almacen,
                            Math.abs(diferencia),
                            receta.recetas_detalle,
                            null
                        );
                        
                        if (resultadoDevolver.success) {
                            console.log('✅ [VERIFICAR PRODUCCIÓN] Ingredientes devueltos correctamente');
                        } else {
                            console.log('⚠️ [VERIFICAR PRODUCCIÓN] Error devolviendo ingredientes:', resultadoDevolver.message);
                        }
                        
                    } else if (diferencia > 0) {
                        // VERIFICÓ MÁS: Restar ingredientes de la diferencia
                        console.log('🔍 [VERIFICAR PRODUCCIÓN] Verificó MÁS, restando ingredientes de:', diferencia);
                        const resultadoRestar = await movimientosAlmacen.restarIngredientes(
                            registro.producto_almacen,
                            diferencia,
                            receta.recetas_detalle,
                            null
                        );
                        
                        if (resultadoRestar.success) {
                            console.log('✅ [VERIFICAR PRODUCCIÓN] Ingredientes restados correctamente');
                        } else {
                            console.log('⚠️ [VERIFICAR PRODUCCIÓN] Error restando ingredientes:', resultadoRestar.message);
                        }
                    }
                } else {
                    console.log('ℹ️ [VERIFICAR PRODUCCIÓN] Producto sin ingredientes, no hay ajuste que hacer');
                }
            } else {
                console.log('ℹ️ [VERIFICAR PRODUCCIÓN] Sin diferencia o producto sin recetas, no hay ajuste que hacer');
            }

            // Actualizar el registro con los datos de verificación
            const { data: registroActualizado, error: updateError } = await supabase
                .from('registros_produccion_damabrava')
                .update({
                    estado: 'verificado',
                    fecha_verificado: ahoraBolivia.toISOString().split('T')[0], // Solo fecha (YYYY-MM-DD)
                    cantidad_verificada: parseFloat(cantidad_verificada),
                    observaciones: observaciones || null
                })
                .eq('id', registroId)
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description
                    ),
                    sucursal:sucursal_id(
                        id,
                        name
                    )
                `)
                .single();

            if (updateError) {
                console.error('Error actualizando registro:', updateError);
                return { success: false, message: 'Error al verificar el registro' };
            }

            // Obtener información del usuario o personal
            let user = null;
            let personal = null;

            // Si tiene user_id, obtener el usuario
            if (registroActualizado.user_id) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.user_id)
                    .single();
                
                if (!userError && userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            // Si tiene personal_id, obtener el personal
            if (registroActualizado.personal_id) {
                const { data: personalData, error: personalError } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.personal_id)
                    .single();
                
                if (!personalError && personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            return { 
                success: true, 
                message: 'Registro verificado correctamente',
                data: {
                    ...registroActualizado,
                    user,
                    personal
                }
            };

        } catch (error) {
            console.error('Error en verificar registro:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    // Anular verificación de un registro de producción
    static async unverify(registroId) {
        try {
            console.log('🔍 [ANULAR VERIFICACIÓN] Iniciando anulación:', registroId);

            // Verificar que el registro existe y obtener datos completos
            const { data: registro, error: registroError } = await supabase
                .from('registros_produccion_damabrava')
                .select(`
                    id, 
                    estado, 
                    cantidad_ingresada,
                    terminados,
                    cantidad_verificada,
                    producto_almacen_id,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        recetas(
                            id,
                            descripcion,
                            recetas_detalle(
                                id,
                                cantidad,
                                products_acopio:producto_acopio_id(
                                    id,
                                    name,
                                    quantity
                                )
                            )
                        )
                    )
                `)
                .eq('id', registroId)
                .single();

            if (registroError) {
                console.error('❌ [ANULAR VERIFICACIÓN] Error obteniendo registro:', registroError);
                return { success: false, message: 'Registro no encontrado' };
            }

            if (!registro) {
                console.log('❌ [ANULAR VERIFICACIÓN] Registro no encontrado');
                return { success: false, message: 'Registro no encontrado' };
            }

            if (registro.estado !== 'verificado') {
                console.log('❌ [ANULAR VERIFICACIÓN] Registro no está verificado:', registro.estado);
                return { success: false, message: 'Solo se pueden anular verificaciones de registros verificados' };
            }

            // Verificar que no haya cantidad ingresada
            if (registro.cantidad_ingresada && registro.cantidad_ingresada > 0) {
                console.log('❌ [ANULAR VERIFICACIÓN] Ya hay cantidad ingresada:', registro.cantidad_ingresada);
                return { 
                    success: false, 
                    message: 'No se puede anular la verificación porque ya hay cantidad ingresada al almacén' 
                };
            }

            console.log('🔍 [ANULAR VERIFICACIÓN] Registro obtenido:', {
                id: registro.id,
                terminados: registro.terminados,
                cantidad_verificada: registro.cantidad_verificada,
                diferencia: registro.cantidad_verificada - registro.terminados
            });

            // REVERTIR AJUSTE DE INGREDIENTES DE LA VERIFICACIÓN
            const cantidadRegistrada = registro.terminados;
            const cantidadVerificada = registro.cantidad_verificada;
            const diferencia = cantidadVerificada - cantidadRegistrada;

            console.log('🔍 [ANULAR VERIFICACIÓN] Análisis de diferencia a revertir:', {
                cantidadRegistrada,
                cantidadVerificada,
                diferencia,
                tipo: diferencia > 0 ? 'MÁS' : diferencia < 0 ? 'MENOS' : 'IGUAL'
            });

            // Si hay diferencia, revertir el ajuste de ingredientes
            if (diferencia !== 0 && registro.producto_almacen && 
                registro.producto_almacen.recetas && 
                registro.producto_almacen.recetas.length > 0) {
                
                const receta = registro.producto_almacen.recetas[0];
                if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {
                    
                    if (diferencia < 0) {
                        // VERIFICÓ MENOS: Revertir devolución (restar de vuelta)
                        console.log('🔍 [ANULAR VERIFICACIÓN] Verificó MENOS, revirtiendo devolución (restando):', Math.abs(diferencia));
                        const resultadoRevertir = await movimientosAlmacen.restarIngredientes(
                            registro.producto_almacen,
                            Math.abs(diferencia),
                            receta.recetas_detalle,
                            null
                        );
                        
                        if (resultadoRevertir.success) {
                            console.log('✅ [ANULAR VERIFICACIÓN] Reversión completada correctamente');
                        } else {
                            console.log('⚠️ [ANULAR VERIFICACIÓN] Error revirtiendo:', resultadoRevertir.message);
                        }
                        
                    } else if (diferencia > 0) {
                        // VERIFICÓ MÁS: Revertir resta (devolver de vuelta)
                        console.log('🔍 [ANULAR VERIFICACIÓN] Verificó MÁS, revirtiendo resta (devolviendo):', diferencia);
                        const resultadoRevertir = await movimientosAlmacen.devolverIngredientes(
                            registro.producto_almacen,
                            diferencia,
                            receta.recetas_detalle,
                            null
                        );
                        
                        if (resultadoRevertir.success) {
                            console.log('✅ [ANULAR VERIFICACIÓN] Reversión completada correctamente');
                        } else {
                            console.log('⚠️ [ANULAR VERIFICACIÓN] Error revirtiendo:', resultadoRevertir.message);
                        }
                    }
                } else {
                    console.log('ℹ️ [ANULAR VERIFICACIÓN] Producto sin ingredientes, no hay reversión que hacer');
                }
            } else {
                console.log('ℹ️ [ANULAR VERIFICACIÓN] Sin diferencia o producto sin recetas, no hay reversión que hacer');
            }

            // Actualizar el registro quitando los datos de verificación
            const { data: registroActualizado, error: updateError } = await supabase
                .from('registros_produccion_damabrava')
                .update({
                    estado: 'pendiente',
                    fecha_verificado: null,
                    cantidad_verificada: null,
                    observaciones: null
                })
                .eq('id', registroId)
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description
                    ),
                    sucursal:sucursal_id(
                        id,
                        name
                    )
                `)
                .single();

            if (updateError) {
                console.error('Error actualizando registro:', updateError);
                return { success: false, message: 'Error al anular la verificación' };
            }

            // Obtener información del usuario o personal
            let user = null;
            let personal = null;

            // Si tiene user_id, obtener el usuario
            if (registroActualizado.user_id) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.user_id)
                    .single();
                
                if (!userError && userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            // Si tiene personal_id, obtener el personal
            if (registroActualizado.personal_id) {
                const { data: personalData, error: personalError } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.personal_id)
                    .single();
                
                if (!personalError && personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            return { 
                success: true, 
                message: 'Verificación anulada correctamente',
                data: {
                    ...registroActualizado,
                    user,
                    personal
                }
            };

        } catch (error) {
            console.error('Error en anular verificación:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    // Actualizar cantidad ingresada de un registro de producción
    static async updateCantidadIngresada(registroId, cantidadIngresada) {
        try {
            // Verificar que el registro existe y está verificado
            const { data: registro, error: registroError } = await supabase
                .from('registros_produccion_damabrava')
                .select('id, estado, cantidad_verificada, cantidad_ingresada')
                .eq('id', registroId)
                .single();

            if (registroError) {
                console.error('Error obteniendo registro:', registroError);
                return { success: false, message: 'Registro no encontrado' };
            }

            if (!registro) {
                return { success: false, message: 'Registro no encontrado' };
            }

            if (registro.estado !== 'verificado' && registro.estado !== 'Ingresado') {
                return { success: false, message: 'Solo se pueden ingresar cantidades de registros verificados' };
            }

            // Validar que la nueva cantidad no exceda la cantidad verificada
            if (cantidadIngresada > registro.cantidad_verificada) {
                return { 
                    success: false, 
                    message: `No se puede ingresar más de ${registro.cantidad_verificada} unidades verificadas` 
                };
            }

            // Determinar el nuevo estado basado en si la cantidad ingresada es igual a la verificada
            const nuevoEstado = cantidadIngresada >= registro.cantidad_verificada ? 'Ingresado' : 'verificado';

            // Actualizar el registro con la nueva cantidad ingresada
            const { data: registroActualizado, error: updateError } = await supabase
                .from('registros_produccion_damabrava')
                .update({
                    cantidad_ingresada: parseFloat(cantidadIngresada),
                    estado: nuevoEstado
                })
                .eq('id', registroId)
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description
                    ),
                    sucursal:sucursal_id(
                        id,
                        name
                    )
                `)
                .single();

            if (updateError) {
                console.error('Error actualizando registro:', updateError);
                return { success: false, message: 'Error al actualizar la cantidad ingresada' };
            }

            // Obtener información del usuario o personal
            let user = null;
            let personal = null;

            // Si tiene user_id, obtener el usuario
            if (registroActualizado.user_id) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.user_id)
                    .single();
                
                if (!userError && userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            // Si tiene personal_id, obtener el personal
            if (registroActualizado.personal_id) {
                const { data: personalData, error: personalError } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.personal_id)
                    .single();
                
                if (!personalError && personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            return { 
                success: true, 
                message: `Cantidad ingresada actualizada correctamente. Estado: ${nuevoEstado}`,
                data: {
                    ...registroActualizado,
                    user,
                    personal
                }
            };

        } catch (error) {
            console.error('Error en actualizar cantidad ingresada:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }

    // Obtener registros de producción del usuario actual
    static async getByUser(userId, userType, page = 1, limit = 10, estado = null, ordenamiento = 'fecha_desc', search = '') {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('registros_produccion_damabrava')
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description
                    ),
                    sucursal:sucursal_id(
                        id,
                        name
                    ),
                    user:user_id(
                        id,
                        first_name,
                        last_name
                    ),
                    personal:personal_id(
                        id,
                        first_name,
                        last_name
                    )
                `, { count: 'exact' });

            // Filtrar por user_id o personal_id según el tipo de usuario
            if (userType === 'employee') {
                query = query.eq('personal_id', userId);
            } else {
                query = query.eq('user_id', userId);
            }

            // Aplicar filtro de estado si se proporciona
            if (estado) {
                query = query.eq('estado', estado);
            }

            // Aplicar ordenamiento
            const ascending = ordenamiento === 'fecha_asc';
            query = query.order('fecha', { ascending });

            const { data: registros, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                return { success: false, message: 'Error al obtener registros de producción', error };
            }

            // Si no hay registros, retornar array vacío
            if (!registros || registros.length === 0) {
                return {
                    success: true,
                    data: [],
                    pagination: {
                        total: count || 0,
                        page,
                        limit,
                        hasNextPage: false
                    }
                };
            }

            // Procesar datos de usuario/personal (ya vienen en la consulta)
            const registrosConUsuarios = registros.map(registro => {
                let user = null;
                let personal = null;

                // Procesar usuario si existe
                if (registro.user) {
                    user = {
                        id: registro.user.id,
                        name: `${registro.user.first_name} ${registro.user.last_name}`.trim()
                    };
                }

                // Procesar personal si existe
                if (registro.personal) {
                    personal = {
                        id: registro.personal.id,
                        name: `${registro.personal.first_name} ${registro.personal.last_name}`.trim()
                    };
                }

                return {
                    ...registro,
                    user,
                    personal
                };
            });

            // Aplicar búsqueda por texto si se proporciona
            let registrosFiltrados = registrosConUsuarios;
            if (search && search.trim()) {
                const searchTerm = search.toLowerCase().trim();
                registrosFiltrados = registrosConUsuarios.filter(registro => {
                    // Buscar en nombre del producto
                    const nombreProducto = (registro.producto_almacen?.name || '').toLowerCase();
                    
                    // Buscar en nombre del responsable (usuario o personal)
                    const nombreResponsable = (registro.user?.name || registro.personal?.name || '').toLowerCase();
                    
                    // Buscar en lote (convertir a string)
                    const lote = String(registro.lote || '').toLowerCase();
                    
                    return nombreProducto.includes(searchTerm) || 
                           nombreResponsable.includes(searchTerm) || 
                           lote.includes(searchTerm);
                });
            }

            // Recalcular paginación si hay búsqueda
            const totalFiltrados = registrosFiltrados.length;
            const hasNextPageFiltrado = search ? false : count > offset + limit; // Si hay búsqueda, no hay paginación

            return {
                success: true,
                data: registrosFiltrados,
                pagination: {
                    total: search ? totalFiltrados : count,
                    page,
                    limit,
                    hasNextPage: hasNextPageFiltrado
                }
            };

        } catch (error) {
            console.error('Error en registrosProduccionDamabrava.getByUser:', error);
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Restar cantidad ingresada cuando se anula un movimiento de producción
    static async restarCantidadIngresada(registroId, cantidadARestar) {
        try {
            // Obtener el registro actual
            const { data: registro, error: registroError } = await supabase
                .from('registros_produccion_damabrava')
                .select('id, estado, cantidad_ingresada, cantidad_verificada')
                .eq('id', registroId)
                .single();

            if (registroError) {
                console.error('Error obteniendo registro:', registroError);
                return { success: false, message: 'Registro no encontrado' };
            }

            if (!registro) {
                return { success: false, message: 'Registro no encontrado' };
            }

            // Calcular la nueva cantidad ingresada
            const nuevaCantidadIngresada = Math.max(0, (registro.cantidad_ingresada || 0) - cantidadARestar);
            
            // Determinar el nuevo estado del registro
            let nuevoEstado = registro.estado;
            if (registro.estado === 'Ingresado' && nuevaCantidadIngresada < registro.cantidad_verificada) {
                nuevoEstado = 'verificado';
            }

            // Actualizar el registro
            const { data: registroActualizado, error: updateError } = await supabase
                .from('registros_produccion_damabrava')
                .update({
                    cantidad_ingresada: nuevaCantidadIngresada,
                    estado: nuevoEstado
                })
                .eq('id', registroId)
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description
                    ),
                    sucursal:sucursal_id(
                        id,
                        name
                    )
                `)
                .single();

            if (updateError) {
                console.error('Error actualizando registro:', updateError);
                return { success: false, message: 'Error al actualizar la cantidad ingresada' };
            }

            // Obtener información del usuario o personal
            let user = null;
            let personal = null;

            // Si tiene user_id, obtener el usuario
            if (registroActualizado.user_id) {
                const { data: userData, error: userError } = await supabase
                    .from('users')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.user_id)
                    .single();
                
                if (!userError && userData) {
                    user = {
                        id: userData.id,
                        name: `${userData.first_name} ${userData.last_name}`.trim()
                    };
                }
            }

            // Si tiene personal_id, obtener el personal
            if (registroActualizado.personal_id) {
                const { data: personalData, error: personalError } = await supabase
                    .from('personal')
                    .select('id, first_name, last_name')
                    .eq('id', registroActualizado.personal_id)
                    .single();
                
                if (!personalError && personalData) {
                    personal = {
                        id: personalData.id,
                        name: `${personalData.first_name} ${personalData.last_name}`.trim()
                    };
                }
            }

            return { 
                success: true, 
                message: `Cantidad ingresada actualizada correctamente. Estado: ${nuevoEstado}`,
                data: {
                    ...registroActualizado,
                    user,
                    personal
                }
            };

        } catch (error) {
            console.error('Error en restar cantidad ingresada:', error);
            return { success: false, message: 'Error interno del servidor' };
        }
    }


}

module.exports = registrosProduccionDamabrava;
