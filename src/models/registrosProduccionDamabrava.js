const { supabase } = require('../config/supabase');
const productsAlmacen = require('./productsAlmacen');
const movimientosAlmacen = require('./movimientosAlmacen');
const { aplicarFiltroFecha } = require('../utils/fechaRangeHelper');

const enrichRegistroConProducto = async (registro) => {
    if (!registro || !registro.producto_almacen || !registro.producto_almacen.id) {
        return registro;
    }

    const yaTieneRecetas = Array.isArray(registro.producto_almacen.recetas)
        && registro.producto_almacen.recetas.length > 0;
    const yaTieneGramaje = registro.producto_almacen.gramaje !== undefined
        && registro.producto_almacen.gramaje !== null;

    if (yaTieneRecetas && yaTieneGramaje) {
        return registro;
    }

    try {
        const productoDetalle = await productsAlmacen.getById(registro.producto_almacen.id);
        if (productoDetalle) {
            registro.producto_almacen = {
                ...registro.producto_almacen,
                gramaje: productoDetalle.gramaje ?? registro.producto_almacen.gramaje ?? null,
                recetas: productoDetalle.recetas || [],
            };
        }
    } catch (error) {
        console.error('Error enriqueciendo registro con detalle de producto:', error);
    }

    return registro;
};

const enrichRegistrosConProducto = async (registros = []) => {
    if (!Array.isArray(registros) || registros.length === 0) {
        return registros;
    }

    return Promise.all(registros.map((registro) => enrichRegistroConProducto(registro)));
};

// Función helper para normalizar texto (quitar acentos)
const normalizeText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
        .trim();
};

class registrosProduccionDamabrava {
    static async enrichRegistrosConProducto(registros = []) {
        return enrichRegistrosConProducto(registros);
    }

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

            // Crear timestamp en zona horaria de Bolivia (GMT-4) - CORREGIDO
            const ahora = new Date();
            const ahoraBolivia = ahora; // Usar directamente la hora local del sistema

            // VALIDAR Y RESTAR INGREDIENTES ANTES de crear el registro
            console.log("==> Model.create: ", { producto_almacen_id, terminados, empresa_id });
            if (empresa_id) {
                try {
                    // Obtener el producto con sus recetas
                    const producto = await productsAlmacen.getById(producto_almacen_id, empresa_id);
                    console.log("==> Model.create producto obtenido: ", producto ? producto.name : 'null', "recetas:", producto?.recetas?.length);
                    
                    if (producto && producto.recetas && producto.recetas.length > 0) {
                        const receta = producto.recetas[0];
                        
                        if (receta && receta.recetas_detalle && receta.recetas_detalle.length > 0) {

                            // Usar la función existente de movimientosAlmacen
                            console.log("==> Model.create llamando a restarIngredientes...");
                            const resultadoIngredientes = await movimientosAlmacen.restarIngredientes(
                                producto,
                                parseFloat(terminados),
                                receta.recetas_detalle,
                                empresa_id
                            );
                            
                            console.log("==> Model.create resultado restarIngredientes: ", resultadoIngredientes);
                            
                            // Si la validación falla, retornar error sin crear el registro
                            if (!resultadoIngredientes.success) {
                                return {
                                    success: false,
                                    message: resultadoIngredientes.message,
                                    ingredientesConStockInsuficiente: resultadoIngredientes.ingredientesConStockInsuficiente
                                };
                            }
                            
                        } else {
                            console.log("==> Model.create: la receta no tiene detalles.");
                        }
                    } else {
                        console.log("==> Model.create: el producto no tiene recetas.");
                    }
                } catch (error) {
                    console.error("==> Model.create error en validacion stock: ", error);
                    return {
                        success: false,
                        message: 'Error al validar el stock de ingredientes: ' + error.message
                    };
                }
            } else {
                console.log("==> Model.create: empresa_id es NULL, omitiendo validacion y resta.");
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
                        description,
                        grup
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

            await enrichRegistroConProducto(registro);

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
    static async getAll(
        page = 1,
        limit = 10,
        estado = null,
        ordenamiento = 'fecha_desc',
        search = '',
        responsableId = null,
        responsableTipo = null,
        fechaInicio = null,
        fechaFin = null
    ) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('registros_produccion_damabrava')
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description,
                        grup
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
                `, { count: 'estimated' });

            // Filtro de búsqueda optimizado por Supabase
            if (search && search.trim() !== '') {
                const term = `%${search.trim()}%`;
                
                // 1. Buscar coincidencias en productos
                const { data: prodMatches } = await supabase.from('products_almacen').select('id').ilike('name', term);
                const prodIds = (prodMatches || []).map(p => p.id);
                
                // 2. Buscar coincidencias en users
                const { data: userMatches } = await supabase.from('users').select('id').or(`first_name.ilike.${term},last_name.ilike.${term}`);
                const userIds = (userMatches || []).map(u => u.id);
                
                // 3. Buscar coincidencias en personal
                const { data: persMatches } = await supabase.from('personal').select('id').or(`first_name.ilike.${term},last_name.ilike.${term}`);
                const persIds = (persMatches || []).map(p => p.id);

                const orConditions = [];
                if (prodIds.length > 0) orConditions.push(`producto_almacen_id.in.(${prodIds.join(',')})`);
                if (userIds.length > 0) orConditions.push(`user_id.in.(${userIds.join(',')})`);
                if (persIds.length > 0) orConditions.push(`personal_id.in.(${persIds.join(',')})`);
                
                // 4. Si el término de búsqueda es número, buscar en lote
                if (!isNaN(search)) {
                    orConditions.push(`lote.eq.${search}`);
                }

                if (orConditions.length > 0) {
                    query = query.or(orConditions.join(','));
                } else {
                    // Si no hay coincidencias directas en tablas relacionadas, devolver array vacío sin consultar
                    return { success: true, data: [], pagination: { total: 0, page, limit, hasNextPage: false } };
                }
            }

            if (estado) {
                query = query.eq('estado', estado);
            }

            if (responsableId && responsableTipo) {
                if (responsableTipo === 'personal') {
                    query = query.eq('personal_id', responsableId);
                } else if (responsableTipo === 'usuario') {
                    query = query.eq('user_id', responsableId);
                }
            }

            query = aplicarFiltroFecha(query, 'fecha', { inicio: fechaInicio, fin: fechaFin });

            const ascending = ordenamiento === 'fecha_asc';
            query = query.order('fecha', { ascending });

            // Ejecutar consulta con paginación
            const { data: registros, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                return { success: false, message: 'Error al obtener registros de producción', error };
            }

            if (!registros || registros.length === 0) {
                return {
                    success: true,
                    data: [],
                    pagination: { total: count || 0, page, limit, hasNextPage: false }
                };
            }

            // Procesar usuarios y personal
            const registrosConUsuarios = registros.map(registro => ({
                ...registro,
                user: registro.user ? { id: registro.user.id, name: `${registro.user.first_name} ${registro.user.last_name}`.trim() } : null,
                personal: registro.personal ? { id: registro.personal.id, name: `${registro.personal.first_name} ${registro.personal.last_name}`.trim() } : null
            }));

            // Enriquecer registros con recetas del producto para cálculos de pago
            const registrosEnriquecidos = await enrichRegistrosConProducto(registrosConUsuarios);

            return {
                success: true,
                data: registrosEnriquecidos,
                pagination: {
                    total: count,
                    page,
                    limit,
                    hasNextPage: count > offset + limit
                }
            };
        } catch (error) {
            return { success: false, message: 'Error interno del servidor', error };
        }
    }

    // Obtener un registro de producción por ID
    static async getById(id) {
        try {
            if (!id) {
                return { success: false, message: 'ID es requerido' };
            }

            const { data, error } = await supabase
                .from('registros_produccion_damabrava')
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description,
                        grup
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
                `)
                .eq('id', id)
                .single();

            if (error || !data) {
                return { success: false, message: 'Registro no encontrado' };
            }

            const registro = { ...data };
            if (registro.user) {
                registro.user = {
                    ...registro.user,
                    name: `${registro.user.first_name || ''} ${registro.user.last_name || ''}`.trim()
                };
            }
            if (registro.personal) {
                registro.personal = {
                    ...registro.personal,
                    name: `${registro.personal.first_name || ''} ${registro.personal.last_name || ''}`.trim()
                };
            }

            const enriched = await enrichRegistroConProducto(registro);
            return { success: true, data: enriched };
        } catch (error) {
            return { success: false, message: error.message || 'Error al obtener el registro' };
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
                        grup,
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

            // Crear timestamp en zona horaria de Bolivia (GMT-4) - CORREGIDO
            const ahora = new Date();
            const ahoraBolivia = ahora; // Usar directamente la hora local del sistema

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
                        grup,
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

            // PRIMERO: Validar y ajustar ingredientes ANTES de actualizar el registro
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
                            // Si falla la devolución, retornar error y no continuar con la verificación
                            return {
                                success: false,
                                message: resultadoDevolver.message
                            };
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
                            // Si no hay suficiente stock, retornar error y no continuar con la verificación
                            return {
                                success: false,
                                message: resultadoRestar.message,
                                ingredientesConStockInsuficiente: resultadoRestar.ingredientesConStockInsuficiente
                            };
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
                    fecha_verificado: ahoraBolivia.toISOString(), // Usar timestamp completo en zona horaria de Bolivia
                    cantidad_verificada: parseFloat(cantidad_verificada),
                    observaciones: observaciones || null
                })
                .eq('id', registroId)
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description,
                        grup
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

            await enrichRegistroConProducto(registroActualizado);

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
                        grup,
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
                            // Si no hay suficiente stock para revertir, retornar error
                            return {
                                success: false,
                                message: resultadoRevertir.message,
                                ingredientesConStockInsuficiente: resultadoRevertir.ingredientesConStockInsuficiente
                            };
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
                            // Si falla la reversión, retornar error y no continuar con la anulación
                            return {
                                success: false,
                                message: resultadoRevertir.message
                            };
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
                        description,
                        grup
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

            await enrichRegistroConProducto(registroActualizado);

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
                        description,
                        grup
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

            await enrichRegistroConProducto(registroActualizado);

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
    static async getByUser(userId, userType, page = 1, limit = 10, estado = null, ordenamiento = 'fecha_desc', search = '', fechaInicio = null, fechaFin = null) {
        try {
            const offset = (page - 1) * limit;

            let query = supabase
                .from('registros_produccion_damabrava')
                .select(`
                    *,
                    producto_almacen:producto_almacen_id(
                        id,
                        name,
                        description,
                        grup
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
                `, { count: 'estimated' });

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

            // Filtro por fecha de registro
            if (fechaInicio) {
                query = query.gte('fecha', fechaInicio);
            }
            if (fechaFin) {
                query = query.lte('fecha', fechaFin);
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

            // No enriquecer con recetas completas la lista por razones de rendimiento
            const registrosConProducto = registrosConUsuarios;

            // Aplicar búsqueda por texto si se proporciona
            let registrosFiltrados = registrosConProducto;
            if (search && search.trim()) {
                const searchTerm = search.toLowerCase().trim();
                registrosFiltrados = registrosConProducto.filter(registro => {
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
                        description,
                        grup
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

            await enrichRegistroConProducto(registroActualizado);

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
