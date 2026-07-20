const { supabase } = require('../config/supabase');

class sucursales {
    // Obtener todas las sucursales de una empresa y "Casa Matriz" de empresas asociadas
    static async getAll(empresaId, empresasAsociadasIds = []) {
        try {
            if (!empresaId) {
                throw new Error('ID de la empresa es requerido');
            }

            const { data, error } = await supabase
                .from('sucursales')
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id,
                        tipo,
                        codigo
                    ),
                    sucursal_precios (
                        precio_id,
                        prices_types:precio_id (
                            id,
                            name
                        )
                    )
                `)
                .eq('empresa_id', empresaId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            let dataMapeada = (data || []).map(sucursal => {
                const precios = (sucursal.sucursal_precios || [])
                    .map(sp => sp.prices_types)
                    .filter(Boolean);
                
                return {
                    ...sucursal,
                    precios: precios
                };
            });

            if (Array.isArray(empresasAsociadasIds) && empresasAsociadasIds.length > 0) {
                const { data: casasMatriz, error: errorCasasMatriz } = await supabase
                    .from('sucursales')
                    .select(`
                        id,
                        name,
                        almacen_sucursal_id,
                        total_pedidos,
                        created_at,
                        empresas!inner (
                            id,
                            name,
                            propietario_id,
                            tipo,
                            codigo
                        ),
                        sucursal_precios (
                            precio_id,
                            prices_types:precio_id (
                                id,
                                name
                            )
                        )
                    `)
                    .in('empresa_id', empresasAsociadasIds)
                    .eq('name', 'Casa Matriz')
                    .order('created_at', { ascending: true });

                if (!errorCasasMatriz && casasMatriz && casasMatriz.length > 0) {
                    const casasMatrizMapeadas = casasMatriz.map(sucursal => {
                        const precios = (sucursal.sucursal_precios || [])
                            .map(sp => sp.prices_types)
                            .filter(Boolean);
                        
                        const nombreEmpresa = sucursal.empresas?.name || '';
                        const nombreVisual = nombreEmpresa ? `Casa Matriz (${nombreEmpresa})` : 'Casa Matriz';
                        
                        return {
                            ...sucursal,
                            name: nombreVisual,
                            precios: precios
                        };
                    });

                    dataMapeada = [...dataMapeada, ...casasMatrizMapeadas];
                }
            }

            return dataMapeada;
        } catch (error) {
            console.error('Error en sucursales.getAll:', error);
            throw new Error('No se pudo obtener las sucursales');
        }
    }

    static async getById(id) {
        try {
            if (!id) throw new Error('ID de sucursal es requerido');

            const { data, error } = await supabase
                .from('sucursales')
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id,
                        tipo,
                        codigo
                    ),
                    sucursal_precios (
                        precio_id,
                        prices_types:precio_id (
                            id,
                            name
                        )
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;

            const precios = (data.sucursal_precios || [])
                .map(sp => sp.prices_types)
                .filter(Boolean);

            return {
                ...data,
                precios: precios
            };
        } catch (error) {
            console.error('Error en sucursales.getById:', error);
            throw new Error('No se pudo obtener la sucursal');
        }
    }

    static async create(sucursalData, precios = []) {
        try {
            const { data, error } = await supabase
                .from('sucursales')
                .insert([sucursalData])
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id,
                        codigo
                    )
                `)
                .single();

            if (error) throw error;

            if (precios && Array.isArray(precios) && precios.length > 0 && data.id) {
                await this.syncPreciosSucursal(data.id, precios);
            }

            let preciosActualizados = [];
            if (data.id) {
                preciosActualizados = await this.getPreciosBySucursalId(data.id);
            }

            return {
                ...data,
                precios: preciosActualizados
            };
        } catch (error) {
            console.error('Error al crear sucursal:', error);
            throw new Error('No se pudo crear la sucursal');
        }
    }

    static async update(id, sucursalData, precios = null) {
        try {
            if (!id) throw new Error('ID de sucursal es requerido');

            const { data, error } = await supabase
                .from('sucursales')
                .update(sucursalData)
                .eq('id', id)
                .select(`
                    id,
                    name,
                    almacen_sucursal_id,
                    total_pedidos,
                    created_at,
                    empresas!inner (
                        id,
                        name,
                        propietario_id,
                        codigo
                    )
                `)
                .single();

            if (error) throw error;

            if (precios !== null && Array.isArray(precios) && data.id) {
                await this.syncPreciosSucursal(data.id, precios);
            }

            const preciosActualizados = await this.getPreciosBySucursalId(data.id);

            return {
                ...data,
                precios: preciosActualizados
            };
        } catch (error) {
            console.error('Error al actualizar sucursal:', error);
            throw new Error('No se pudo actualizar la sucursal');
        }
    }

    static async delete(id) {
        try {
            if (!id) throw new Error('ID de sucursal es requerido');

            const sucursalExistente = await this.getById(id);
            if (!sucursalExistente) {
                throw new Error('La sucursal no existe');
            }

            const { data: movimientosAcopio } = await supabase.from('movimientos_acopio').select('id').eq('sucu_id', id).limit(1);
            const { data: movimientosAlmacen } = await supabase.from('movimientos_almacen').select('id').eq('sucu_id', id).limit(1);
            const { data: pedidosAcopio } = await supabase.from('pedidos_acopio').select('id').eq('sucu_id', id).limit(1);
            const { data: pedidosAlmacen } = await supabase.from('pedidos_almacen').select('id').eq('sucursal_id', id).limit(1);
            const { data: personal } = await supabase.from('personal').select('id').eq('sucursal_id', id).limit(1);

            if (movimientosAcopio && movimientosAcopio.length > 0) throw new Error('No se puede eliminar la sucursal porque tiene movimientos de acopio asociados');
            if (movimientosAlmacen && movimientosAlmacen.length > 0) throw new Error('No se puede eliminar la sucursal porque tiene movimientos de almacén asociados');
            if (pedidosAcopio && pedidosAcopio.length > 0) throw new Error('No se puede eliminar la sucursal porque tiene pedidos de acopio asociados');
            if (pedidosAlmacen && pedidosAlmacen.length > 0) throw new Error('No se puede eliminar la sucursal porque tiene pedidos de almacén asociados');
            if (personal && personal.length > 0) throw new Error('No se puede eliminar la sucursal porque tiene personal asociado');

            const { error } = await supabase
                .from('sucursales')
                .delete()
                .eq('id', id);

            if (error) {
                if (error.code === '23503') throw new Error('No se puede eliminar la sucursal porque tiene registros relacionados en otras tablas');
                throw new Error(`Error de base de datos: ${error.message}`);
            }

            return true;
        } catch (error) {
            console.error('Error al eliminar sucursal:', error);
            throw error;
        }
    }

    static async syncPreciosSucursal(sucursalId, nuevosPreciosIds) {
        try {
            const { data: preciosActuales, error: errorActuales } = await supabase
                .from('sucursal_precios')
                .select('precio_id')
                .eq('sucursal_id', sucursalId);

            if (errorActuales) throw errorActuales;

            const preciosActualesIds = (preciosActuales || []).map(p => p.precio_id);
            const nuevosPreciosIdsSet = new Set(nuevosPreciosIds || []);

            const preciosAEliminar = preciosActualesIds.filter(id => !nuevosPreciosIdsSet.has(id));
            const preciosAAgregar = nuevosPreciosIds.filter(id => !preciosActualesIds.includes(id));

            if (preciosAEliminar.length > 0) {
                const { error: errorEliminar } = await supabase
                    .from('sucursal_precios')
                    .delete()
                    .eq('sucursal_id', sucursalId)
                    .in('precio_id', preciosAEliminar);

                if (errorEliminar) throw errorEliminar;
            }

            if (preciosAAgregar.length > 0) {
                const relacionesAAgregar = preciosAAgregar.map(precioId => ({
                    sucursal_id: sucursalId,
                    precio_id: precioId
                }));

                const { error: errorAgregar } = await supabase
                    .from('sucursal_precios')
                    .insert(relacionesAAgregar);

                if (errorAgregar) throw errorAgregar;
            }

            return true;
        } catch (error) {
            console.error('Error en syncPreciosSucursal:', error);
            throw new Error('Error al sincronizar precios');
        }
    }

    static async getPreciosBySucursalId(sucursalId) {
        try {
            if (!sucursalId) throw new Error('ID de sucursal es requerido');

            const { data, error } = await supabase
                .from('sucursal_precios')
                .select(`
                    precio_id,
                    prices_types:precio_id (
                        id,
                        name,
                        description
                    )
                `)
                .eq('sucursal_id', sucursalId);

            if (error) throw error;

            return (data || []).map(item => item.prices_types).filter(Boolean);
        } catch (error) {
            console.error('Error en getPreciosBySucursalId:', error);
            throw new Error('Error al obtener los precios de la sucursal');
        }
    }
}

module.exports = sucursales;