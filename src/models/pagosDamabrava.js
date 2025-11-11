const { supabase } = require('../config/supabase');
const productsAlmacen = require('./productsAlmacen');
const registrosProduccionDamabrava = require('./registrosProduccionDamabrava');

class pagosDamabrava {
    static formatPersona(persona) {
        if (!persona) return null;
        const firstName = persona.first_name || '';
        const lastName = persona.last_name || '';
        const name = `${firstName} ${lastName}`.trim();
        return {
            id: persona.id,
            name: name || persona.name || 'Sin nombre'
        };
    }

    static normalizeText(value = '') {
        return value
            ? value
                .toString()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
            : '';
    }

    static async fetchRegistrosDetalles(registroIds = []) {
        if (!registroIds || registroIds.length === 0) {
            return { map: new Map(), error: null };
        }

        try {
            const { data, error } = await supabase
                .from('registros_produccion_damabrava')
                .select(`
                    id,
                    fecha,
                    estado,
                    terminados,
                    cantidad_verificada,
                    responsable_id,
                    user_id,
                    personal_id,
                    producto_almacen_id,
                    producto_almacen:producto_almacen_id(
                        id,
                        name
                    )
                `)
                .in('id', registroIds);

            if (error) {
                console.error('[pagosDamabravaModel.fetchRegistrosDetalles] Error obteniendo registros de producción:', error);
                return { map: new Map(), error };
            }

            const productoIds = Array.from(
                new Set(
                    (data || [])
                        .map((registro) => registro.producto_almacen_id || registro.producto_almacen?.id)
                        .filter(Boolean)
                )
            );

            const { map: recetasMap } = await this.fetchRecetasPorProducto(productoIds);

            const map = new Map();
            (data || []).forEach((registro) => {
                const producto = registro.producto_almacen
                    ? {
                          ...registro.producto_almacen,
                          recetas: recetasMap.get(registro.producto_almacen_id || registro.producto_almacen?.id) || []
                      }
                    : null;

                map.set(registro.id, {
                    id: registro.id,
                    fecha: registro.fecha,
                    estado: registro.estado,
                    terminados: Number(registro.terminados) || 0,
                    cantidad_verificada: Number(registro.cantidad_verificada) || 0,
                    responsable_id: registro.responsable_id || null,
                    user_id: registro.user_id || null,
                    personal_id: registro.personal_id || null,
                    producto_almacen: producto,
                    producto_almacen_id: registro.producto_almacen_id || registro.producto_almacen?.id || null
                });
            });

            return { map, error: null };
        } catch (error) {
            console.error('[pagosDamabravaModel.fetchRegistrosDetalles] Error inesperado:', error);
            return { map: new Map(), error };
        }
    }

    static async fetchRecetasPorProducto(productoIds = []) {
        if (!productoIds || productoIds.length === 0) {
            return { map: new Map(), error: null };
        }

        try {
            const { data, error } = await supabase
                .from('recetas')
                .select(`
                    id,
                    producto_almacen_id,
                    recetas_detalle(
                        id,
                        cantidad,
                        products_acopio:producto_acopio_id(
                            id,
                            name,
                            quantity,
                            type_measure:type_measure_id(
                                id,
                                name,
                                code,
                                code_menor,
                                value
                            )
                        )
                    )
                `)
                .in('producto_almacen_id', productoIds);

            if (error) {
                console.error('[pagosDamabravaModel.fetchRecetasPorProducto] Error obteniendo recetas:', error);
                return { map: new Map(), error };
            }

            const map = new Map();
            (data || []).forEach((receta) => {
                const existentes = map.get(receta.producto_almacen_id) || [];
                existentes.push({
                    id: receta.id,
                    recetas_detalle: receta.recetas_detalle || []
                });
                map.set(receta.producto_almacen_id, existentes);
            });

            return { map, error: null };
        } catch (error) {
            console.error('[pagosDamabravaModel.fetchRecetasPorProducto] Error inesperado:', error);
            return { map: new Map(), error };
        }
    }

    /**
     * Crea un nuevo registro de pago Damabrava.
     * @param {Object} payload
     * @param {string|null} payload.user_id
     * @param {string|null} payload.personal_id
     * @param {string} payload.empresa_id
     * @param {string} payload.responsable_id
     * @param {number} payload.cernido
     * @param {number} payload.sellado
     * @param {number} payload.envasado
     * @param {number} payload.etiquetado
     * @param {number} payload.extras
     * @param {number} payload.descuento
     * @param {number} payload.aumento
     * @param {string} payload.fecha_inicio - Formato YYYY-MM-DD
     * @param {string} payload.fecha_fin - Formato YYYY-MM-DD
     * @param {number} payload.total
     * @param {string} [payload.estado='pendiente']
     * @returns {Promise<{success: boolean, data?: Object, message?: string, error?: any}>}
     */
    static async create(payload) {
        try {
            const {
                user_id,
                personal_id,
                empresa_id,
                responsable_id,
                cernido = 0,
                sellado = 0,
                envasado = 0,
                etiquetado = 0,
                extras = 0,
                descuento = 0,
                aumento = 0,
                fecha_inicio,
                fecha_fin,
                total = 0,
                estado = 'pendiente',
                registros = []
            } = payload;

            const insertData = {
                empresa_id,
                responsable_id,
                cernido: Number(cernido) || 0,
                sellado: Number(sellado) || 0,
                envasado: Number(envasado) || 0,
                etiquetado: Number(etiquetado) || 0,
                extras: Number(extras) || 0,
                descuento: Number(descuento) || 0,
                aumento: Number(aumento) || 0,
                fecha_inicio,
                fecha_fin,
                total: Number(total) || 0,
                estado: estado || 'pendiente'
            };

            if (user_id) {
                insertData.user_id = user_id;
            }

            if (personal_id) {
                insertData.personal_id = personal_id;
            }

            const { data, error } = await supabase
                .from('pagos_damabrava')
                .insert(insertData)
                .select(`
                    id,
                    fecha,
                    user_id,
                    personal_id,
                    empresa_id,
                    responsable_id,
                    cernido,
                    sellado,
                    envasado,
                    etiquetado,
                    extras,
                    descuento,
                    aumento,
                    fecha_inicio,
                    fecha_fin,
                    total,
                    estado,
                    personal:personal_id(
                        id,
                        first_name,
                        last_name
                    ),
                    user:user_id(
                        id,
                        first_name,
                        last_name
                    ),
                    responsable:responsable_id(
                        id,
                        first_name,
                        last_name
                    )
                `)
                .single();

            if (error) {
                console.error('[pagosDamabravaModel.create] Error insertando pago:', error);
                return {
                    success: false,
                    message: 'Error al registrar el pago.',
                    error
                };
            }

            const registrosIds = Array.isArray(registros)
                ? registros.filter((registroId) => typeof registroId === 'string' && registroId.trim() !== '')
                : [];

            if (registrosIds.length > 0) {
                const registrosPayload = registrosIds.map((registroId) => ({
                    registro_produccion_damabrava_id: registroId,
                    registro_pago_damabrava_id: data.id
                }));

                const { error: registrosError } = await supabase
                    .from('registro_pago_damabrava')
                    .insert(registrosPayload);

                if (registrosError) {
                    console.error('[pagosDamabravaModel.create] Error insertando registros asociados:', registrosError);

                    await supabase
                        .from('pagos_damabrava')
                        .delete()
                        .eq('id', data.id);

                    return {
                        success: false,
                        message: 'Error al asociar los registros de producción al pago.',
                        error: registrosError
                    };
                }
            }

            const pagoCompleto = await this.getById(data.id);

            if (pagoCompleto.success && pagoCompleto.data) {
                return {
                    success: true,
                    data: pagoCompleto.data
                };
            }

            return {
                success: true,
                data: {
                    ...data,
                    registros: registrosIds,
                    extras: Number(data.extras) || 0,
                    descuento: Number(data.descuento) || 0,
                    aumento: Number(data.aumento) || 0,
                    total: Number(data.total) || 0,
                    total_produccion: Number(data.total) || 0,
                    total_con_ajustes: (Number(data.total) || 0) + (Number(data.extras) || 0) + (Number(data.aumento) || 0) - (Number(data.descuento) || 0)
                }
            };
        } catch (error) {
            console.error('[pagosDamabravaModel.create] Error inesperado:', error);
            return {
                success: false,
                message: 'Error interno al registrar el pago.',
                error
            };
        }
    }

    static async getAll(empresaId, { page = 1, limit = 30, estado = null, responsableId = null, search = null } = {}) {
        try {
            if (!empresaId) {
                return { success: false, message: 'ID de la empresa es requerido' };
            }

            const offset = (page - 1) * limit;

            let query = supabase
                .from('pagos_damabrava')
                .select(`
                    *,
                    responsable:responsable_id(
                        id,
                        first_name,
                        last_name
                    ),
                    personal:personal_id(
                        id,
                        first_name,
                        last_name
                    ),
                    user:user_id(
                        id,
                        first_name,
                        last_name
                    )
                `, { count: 'exact' })
                .eq('empresa_id', empresaId)
                .order('fecha', { ascending: false });

            if (estado) {
                query = query.eq('estado', estado);
            }

            if (responsableId) {
                query = query.eq('responsable_id', responsableId);
            }

            const { data: pagos, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                console.error('[pagosDamabravaModel.getAll] Error obteniendo pagos:', error);
                return { success: false, message: 'Error al obtener los pagos.', error };
            }

            if (!pagos || pagos.length === 0) {
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

            const pagoIds = pagos.map((pago) => pago.id);

            const { data: registrosRelacionados, error: registrosError } = await supabase
                .from('registro_pago_damabrava')
                .select('registro_pago_damabrava_id, registro_produccion_damabrava_id')
                .in('registro_pago_damabrava_id', pagoIds);

            if (registrosError) {
                console.error('[pagosDamabravaModel.getAll] Error obteniendo registros asociados:', registrosError);
                return { success: false, message: 'Error al obtener los registros asociados.', error: registrosError };
            }

            const registrosMap = new Map();
            (registrosRelacionados || []).forEach((relacion) => {
                const lista = registrosMap.get(relacion.registro_pago_damabrava_id) || [];
                lista.push(relacion.registro_produccion_damabrava_id);
                registrosMap.set(relacion.registro_pago_damabrava_id, lista);
            });

            const todosLosRegistrosIds = Array.from(
                new Set(
                    (registrosRelacionados || []).map((relacion) => relacion.registro_produccion_damabrava_id)
                )
            );

            const { map: registrosDetallesMap } = await this.fetchRegistrosDetalles(todosLosRegistrosIds);

            const dataFormateada = pagos.map((pago) => {
                const responsable = pagosDamabrava.formatPersona(pago.responsable);
                const personal = pagosDamabrava.formatPersona(pago.personal);
                const user = pagosDamabrava.formatPersona(pago.user);
                const registrosIds = registrosMap.get(pago.id) || [];
                const registros = registrosIds
                    .map((registroId) => registrosDetallesMap.get(registroId))
                    .filter(Boolean);
                const cernido = Number(pago.cernido) || 0;
                const sellado = Number(pago.sellado) || 0;
                const envasado = Number(pago.envasado) || 0;
                const etiquetado = Number(pago.etiquetado) || 0;
                const extras = Number(pago.extras) || 0;
                const descuento = Number(pago.descuento) || 0;
                const aumento = Number(pago.aumento) || 0;
                const totalProduccion = Number(pago.total) || 0;
                const totalConAjustes = totalProduccion + extras + aumento - descuento;

                return {
                    id: pago.id,
                    fecha: pago.fecha,
                    fecha_inicio: pago.fecha_inicio,
                    fecha_fin: pago.fecha_fin,
                    estado: pago.estado,
                    empresa_id: pago.empresa_id,
                    responsable_id: pago.responsable_id,
                    personal_id: pago.personal_id,
                    user_id: pago.user_id,
                    cernido,
                    sellado,
                    envasado,
                    etiquetado,
                    extras,
                    descuento,
                    aumento,
                    total: totalProduccion,
                    total_produccion: totalProduccion,
                    total_con_ajustes: totalConAjustes,
                    responsable,
                    personal,
                    user,
                    registrado_por: personal || user,
                    registros,
                    registros_count: registrosIds.length
                };
            });

            let dataFiltrada = dataFormateada;

            if (search && typeof search === 'string' && search.trim() !== '') {
                const normalizedSearch = this.normalizeText(search);
                dataFiltrada = dataFormateada.filter((pago) => {
                    const responsableNombre = this.normalizeText(pago?.responsable?.name || '');
                    const registradoNombre = this.normalizeText(
                        pago?.registrado_por?.name ||
                        pago?.personal?.name ||
                        pago?.user?.name ||
                        ''
                    );
                    return responsableNombre.includes(normalizedSearch) || registradoNombre.includes(normalizedSearch);
                });
            }

            return {
                success: true,
                data: dataFiltrada,
                pagination: {
                    total: search ? dataFiltrada.length : (count || dataFormateada.length),
                    page,
                    limit,
                    hasNextPage: search ? false : (count ? (offset + pagos.length) < count : false)
                }
            };
        } catch (error) {
            console.error('[pagosDamabravaModel.getAll] Error inesperado:', error);
            return { success: false, message: 'Error interno al obtener los pagos.', error };
        }
    }

    static async getById(id) {
        try {
            if (!id) {
                return { success: false, message: 'ID del pago es requerido' };
            }

            const { data: pago, error } = await supabase
                .from('pagos_damabrava')
                .select(`
                    *,
                    responsable:responsable_id(
                        id,
                        first_name,
                        last_name,
                        name
                    ),
                    personal:personal_id(
                        id,
                        first_name,
                        last_name,
                        name
                    ),
                    user:user_id(
                        id,
                        first_name,
                        last_name,
                        name
                    )
                    responsable:responsable_id(
                        id,
                        first_name,
                        last_name,
                        name
                    ),
                    personal:personal_id(
                        id,
                        first_name,
                        last_name,
                        name
                    ),
                    user:user_id(
                        id,
                        first_name,
                        last_name,
                        name
                    )
                `)
                .eq('id', id)
                .single();

            if (error || !pago) {
                return { success: false, message: 'Pago no encontrado', error };
            }

            const { data: registrosRelacionados, error: registrosError } = await supabase
                .from('registro_pago_damabrava')
                .select('registro_produccion_damabrava_id')
                .eq('registro_pago_damabrava_id', id);

            if (registrosError) {
                console.error('[pagosDamabravaModel.getById] Error obteniendo registros asociados:', registrosError);
                return { success: false, message: 'Error al obtener los registros asociados.', error: registrosError };
            }

            const registroIds = (registrosRelacionados || []).map(
                (relacion) => relacion.registro_produccion_damabrava_id
            );

            const { map: registrosDetallesMap, error: registrosDetallesError } =
                await this.fetchRegistrosDetalles(registroIds);

            if (registrosDetallesError) {
                return {
                    success: false,
                    message: 'Error al obtener los registros asociados.',
                    error: registrosDetallesError
                };
            }

            const registros = registroIds
                .map((registroId) => registrosDetallesMap.get(registroId))
                .filter(Boolean);
            const cernido = Number(pago.cernido) || 0;
            const sellado = Number(pago.sellado) || 0;
            const envasado = Number(pago.envasado) || 0;
            const etiquetado = Number(pago.etiquetado) || 0;
            const extras = Number(pago.extras) || 0;
            const descuento = Number(pago.descuento) || 0;
            const aumento = Number(pago.aumento) || 0;
            const totalProduccion = Number(pago.total) || 0;
            const totalConAjustes = totalProduccion + extras + aumento - descuento;

            return {
                success: true,
                data: {
                    ...pago,
                    cernido,
                    sellado,
                    envasado,
                    etiquetado,
                    extras,
                    descuento,
                    aumento,
                    total: totalProduccion,
                    total_produccion: totalProduccion,
                    total_con_ajustes: totalConAjustes,
                    responsable: pagosDamabrava.formatPersona(pago.responsable),
                    personal: pagosDamabrava.formatPersona(pago.personal),
                    user: pagosDamabrava.formatPersona(pago.user),
                    registrado_por:
                        pagosDamabrava.formatPersona(pago.personal) ||
                        pagosDamabrava.formatPersona(pago.user),
                    registros
                }
            };
        } catch (error) {
            console.error('[pagosDamabravaModel.getById] Error inesperado:', error);
            return { success: false, message: 'Error interno al obtener el pago.', error };
        }
    }

    static async getRegistros(pagoId) {
        try {
            if (!pagoId) {
                return { success: false, message: 'ID del pago es requerido' };
            }

            console.log('[pagosDamabravaModel.getRegistros] Fetching registros for pagoId:', pagoId);

            const { data: relaciones, error } = await supabase
                .from('registro_pago_damabrava')
                .select(`
                    id,
                    registro_produccion_damabrava:registro_produccion_damabrava_id(
                        id,
                        fecha,
                        estado,
                        terminados,
                    cantidad_verificada,
                    producto_almacen_id,
                    producto_almacen:producto_almacen_id(
                        id,
                        name
                    )
                    )
                `)
                .eq('registro_pago_damabrava_id', pagoId);

            if (error) {
                console.error('[pagosDamabravaModel.getRegistros] Error obteniendo relaciones:', error);
                return { success: false, message: 'Error al obtener los registros asociados.', error };
            }

            console.log('[pagosDamabravaModel.getRegistros] Relaciones obtenidas:', JSON.stringify(relaciones, null, 2));

            if (!relaciones || relaciones.length === 0) {
                console.log('[pagosDamabravaModel.getRegistros] No se encontraron registros asociados.');
                return { success: true, data: [] };
            }

        const registrosBase = relaciones
                .map((relacion) => {
                    const registro = relacion.registro_produccion_damabrava;
                    if (!registro) return null;
                const terminados = Math.trunc(Number(registro.terminados) || 0);
                const cantidadVerificada = Math.trunc(Number(registro.cantidad_verificada) || 0);
                const productoAlmacenId = registro.producto_almacen_id || registro.producto_almacen?.id || null;
                    return {
                        id: registro.id,
                        fecha: registro.fecha,
                        estado: registro.estado,
                    terminados,
                    cantidad_verificada: cantidadVerificada,
                        responsable_id: registro.responsable_id || null,
                        user_id: registro.user_id || null,
                    personal_id: registro.personal_id || null,
                    producto_almacen_id: productoAlmacenId,
                    producto_almacen: registro.producto_almacen
                        ? {
                            id: registro.producto_almacen.id,
                            name: registro.producto_almacen.name || 'Sin nombre'
                        }
                        : null
                    };
                })
                .filter(Boolean);

        const productoIds = Array.from(
            new Set(
                registrosBase
                    .map((registro) => registro.producto_almacen_id)
                    .filter(Boolean)
            )
        );

        let productosDetalleMap = new Map();
        if (productoIds.length > 0) {
            try {
                const productosDetalle = await productsAlmacen.getByIds(productoIds);
                productosDetalleMap = new Map(
                    (productosDetalle || []).map((producto) => [producto.id, producto])
                );
            } catch (productoError) {
                console.error('[pagosDamabravaModel.getRegistros] Error obteniendo detalle de productos:', productoError);
            }
        }

        const registrosEnriquecidos = await registrosProduccionDamabrava.enrichRegistrosConProducto(registrosBase);

        const registros = registrosEnriquecidos.map((registro) => {
            const productoDetalle = productosDetalleMap.get(registro.producto_almacen_id);
            if (!productoDetalle) {
                return registro;
            }

            return {
                ...registro,
                producto_almacen: {
                    id: productoDetalle.id,
                    name: productoDetalle.name || registro.producto_almacen?.name || 'Sin nombre',
                    gramaje: productoDetalle.gramaje ?? registro.producto_almacen?.gramaje ?? null,
                    type_measure: productoDetalle.type_measure || null,
                    recetas: productoDetalle.recetas || [],
                    recetas_acopio: productoDetalle.recetas_acopio || []
                }
            };
        });

        console.log('[pagosDamabravaModel.getRegistros] Registros formateados:', JSON.stringify(registros, null, 2));

            return {
                success: true,
                data: registros
            };
        } catch (error) {
            console.error('[pagosDamabravaModel.getRegistros] Error inesperado:', error);
            return { success: false, message: 'Error interno al obtener los registros asociados.', error };
        }
    }

    static async updateEstado(id, estado) {
        try {
            if (!id) {
                return { success: false, message: 'ID del pago es requerido' };
            }

            if (!estado) {
                return { success: false, message: 'El estado es requerido' };
            }

            const { data, error } = await supabase
                .from('pagos_damabrava')
                .update({ estado })
                .eq('id', id)
                .select('id, estado')
                .single();

            if (error) {
                console.error('[pagosDamabravaModel.updateEstado] Error actualizando estado:', error);
                return { success: false, message: 'Error al actualizar el estado del pago.', error };
            }

            return {
                success: true,
                data
            };
        } catch (error) {
            console.error('[pagosDamabravaModel.updateEstado] Error inesperado:', error);
            return { success: false, message: 'Error interno al actualizar el estado.', error };
        }
    }

    static async delete(id) {
        try {
            if (!id) {
                return { success: false, message: 'ID del pago es requerido' };
            }

            const { error } = await supabase
                .from('pagos_damabrava')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('[pagosDamabravaModel.delete] Error eliminando pago:', error);
                return { success: false, message: 'Error al eliminar el pago.', error };
            }

            return {
                success: true,
                message: 'Pago eliminado correctamente.'
            };
        } catch (error) {
            console.error('[pagosDamabravaModel.delete] Error inesperado:', error);
            return { success: false, message: 'Error interno al eliminar el pago.', error };
        }
    }
}

module.exports = pagosDamabrava;

