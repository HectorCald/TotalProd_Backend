const { supabase } = require('../config/supabase');

class ConteosModel {
	static async create(conteoData) {
		try {
			const { tipo, sucursal_id, user_id, personal_id, observaciones, detalles } = conteoData;

			if (!tipo || !['acopio', 'almacen'].includes(tipo)) {
				return { success: false, message: 'El tipo debe ser "acopio" o "almacen"' };
			}
			if (!sucursal_id) {
				return { success: false, message: 'ID de la sucursal es requerido' };
			}
			if (!Array.isArray(detalles) || detalles.length === 0) {
				return { success: false, message: 'Debe incluir al menos un detalle de conteo' };
			}

			// Fecha en zona Bolivia (GMT-4)
			const ahora = new Date();
			const fechaBolivia = new Date(ahora.getTime() - (4 * 60 * 60 * 1000));

			// Insertar encabezado de conteo
			const insertHeader = {
				fecha: fechaBolivia.toISOString(),
				tipo,
				sucursal_id,
				observaciones: observaciones || null
			};
			if (user_id) insertHeader.user_id = user_id;
			if (personal_id) insertHeader.personal_id = personal_id;

			const { data: conteo, error: headerError } = await supabase
				.from('conteos')
				.insert(insertHeader)
				.select('id, fecha, tipo, sucursal_id, user_id, personal_id, observaciones')
				.single();

			if (headerError) {
				return { success: false, message: 'Error al crear el conteo', error: headerError };
			}

			// Preparar detalles
			const detallesRows = detalles.map((d) => {
				const sistema = Number(d.sistema);
				const fisico = Number(d.fisico);
				const row = {
					conteo_id: conteo.id,
					sistema: Number.isFinite(sistema) ? sistema : 0,
					fisico: Number.isFinite(fisico) ? fisico : 0,
					justificacion: d.justificacion || null
				};
				if (tipo === 'almacen') {
					row.producto_almacen_id = d.producto_id;
				} else {
					row.producto_acopio_id = d.producto_id;
				}
				return row;
			});

			const { error: detalleError } = await supabase
				.from('conteo_detalle')
				.insert(detallesRows);

			if (detalleError) {
				// Limpieza si falla detalle
				await supabase.from('conteos').delete().eq('id', conteo.id);
				return { success: false, message: 'Error al crear los detalles del conteo', error: detalleError };
			}

			return { success: true, data: { id: conteo.id } };
		} catch (error) {
			console.error('Error en ConteosModel.create:', error);
			return { success: false, message: 'Error interno del servidor', error };
		}
	}

	static async getAll({ sucursal_id, tipo = null }) {
		try {
			if (!sucursal_id) {
				return { success: false, message: 'ID de la sucursal es requerido' };
			}

			let query = supabase
				.from('conteos')
				.select('*')
				.eq('sucursal_id', sucursal_id)
				.order('fecha', { ascending: false });


			if (tipo) {
				const t = (tipo || '').toString().trim().toLowerCase();
				if (t === 'almacen' || t === 'almacén') {
					query = query.in('tipo', ['almacen', 'Almacen', 'almacén', 'Almacén']);
				} else if (t === 'acopio') {
					query = query.in('tipo', ['acopio', 'Acopio']);
				} else {
					query = query.ilike('tipo', t);
				}
			}

			const { data: headers, error } = await query;
			if (error) {
				return { success: false, message: 'Error al obtener conteos', error };
			}

			if (!headers || headers.length === 0) {
				return { success: true, data: [] };
			}

			const conteoIds = headers.map(h => h.id);
			const { data: detalles, error: detalleError } = await supabase
				.from('conteo_detalle')
				.select(`
					id,
					conteo_id,
					sistema,
					fisico,
					justificacion,
					producto_almacen:producto_almacen_id(
						id,
						name,
						grup
					),
					producto_acopio:producto_acopio_id(
						id,
						name,
						type_measure:type_measure_id(
							id,
							name,
							code
						)
					)
				`)
				.in('conteo_id', conteoIds);

			if (detalleError) {
				return { success: false, message: 'Error al obtener detalles de conteos', error: detalleError };
			}

			// Agrupar detalles por conteo_id
			const detallesPorConteo = new Map();
			conteoIds.forEach(id => detallesPorConteo.set(id, []));
			(detalles || []).forEach(d => {
				const arr = detallesPorConteo.get(d.conteo_id) || [];
				arr.push(d);
				detallesPorConteo.set(d.conteo_id, arr);
			});

			const resultado = headers.map(h => ({
				...h,
				detalles: detallesPorConteo.get(h.id) || []
			}));

			return { success: true, data: resultado };
		} catch (error) {
			console.error('Error en ConteosModel.getAll:', error);
			return { success: false, message: 'Error interno del servidor', error };
		}
	}

	static async delete(conteoId) {
		try {
			if (!conteoId) {
				return { success: false, message: 'ID del conteo es requerido' };
			}

			// Verificar que el conteo existe
			const { data: conteo, error: fetchError } = await supabase
				.from('conteos')
				.select('id')
				.eq('id', conteoId)
				.single();

			if (fetchError || !conteo) {
				return { success: false, message: 'Conteo no encontrado' };
			}

			// Eliminar el conteo (los detalles se eliminan automáticamente por CASCADE)
			const { error: deleteError } = await supabase
				.from('conteos')
				.delete()
				.eq('id', conteoId);

			if (deleteError) {
				return { success: false, message: 'Error al eliminar el conteo', error: deleteError };
			}

			return { success: true, message: 'Conteo eliminado exitosamente' };
		} catch (error) {
			console.error('Error en ConteosModel.delete:', error);
			return { success: false, message: 'Error interno del servidor', error };
		}
	}

	// Reemplazar stock de productos_sucursal con el valor "fisico" del conteo (solo para tipo 'almacen')
	static async replaceStock(conteoId) {
		try {
			if (!conteoId) {
				return { success: false, message: 'ID del conteo es requerido' };
			}

			// 1) Obtener encabezado de conteo para validar tipo y sucursal
			const { data: conteo, error: conteoErr } = await supabase
				.from('conteos')
				.select('id, tipo, sucursal_id')
				.eq('id', conteoId)
				.single();

			if (conteoErr || !conteo) {
				return { success: false, message: 'Conteo no encontrado' };
			}

			if ((conteo.tipo || '').toString().trim().toLowerCase() !== 'almacen') {
				return { success: false, message: 'Reemplazo disponible solo para conteos de almacén' };
			}

			const sucursalId = conteo.sucursal_id;

			// 2) Obtener detalles del conteo (producto_almacen_id, fisico)
			const { data: detalles, error: detErr } = await supabase
				.from('conteo_detalle')
				.select('producto_almacen_id, fisico')
				.eq('conteo_id', conteoId)
				.not('producto_almacen_id', 'is', null);

			if (detErr) {
				return { success: false, message: 'Error al obtener detalles del conteo', error: detErr };
			}

			if (!detalles || detalles.length === 0) {
				return { success: false, message: 'El conteo no tiene detalles de almacén' };
			}

			// Normalizar datos de reemplazo
			const productIdToFisico = new Map();
			for (const d of detalles) {
				if (!d.producto_almacen_id) continue;
				const fisico = Number(d.fisico);
				productIdToFisico.set(d.producto_almacen_id, Number.isFinite(fisico) ? fisico : 0);
			}

			const productIds = Array.from(productIdToFisico.keys());

			// 3) Obtener filas existentes en productos_sucursal para esta sucursal y estos productos
			const { data: existentes, error: exErr } = await supabase
				.from('productos_sucursal')
				.select('id, producto_id, stock')
				.eq('sucursal_id', sucursalId)
				.in('producto_id', productIds);

			if (exErr) {
				return { success: false, message: 'Error al obtener stocks actuales', error: exErr };
			}

			const existentesMap = new Map();
			(existentes || []).forEach(row => existentesMap.set(row.producto_id, row));

			const toUpdate = [];
			const toInsert = [];
			for (const pid of productIds) {
				const fisico = productIdToFisico.get(pid) ?? 0;
				const ex = existentesMap.get(pid);
				if (ex && ex.id) {
					toUpdate.push({ id: ex.id, stock: fisico });
				} else {
					toInsert.push({ producto_id: pid, sucursal_id: sucursalId, stock: fisico });
				}
			}

			// 4) Aplicar cambios en lote (optimizado y compatible)
			// 4.a) Actualizar existentes uno a uno (por PK id)
			if (toUpdate.length > 0) {
				const updateOps = toUpdate.map(u =>
					supabase
						.from('productos_sucursal')
						.update({ stock: u.stock })
						.eq('id', u.id)
				);
				const updateResults = await Promise.allSettled(updateOps);
				for (const r of updateResults) {
					if (r.status === 'rejected' || r.value?.error) {
						return { success: false, message: 'Error al actualizar stock', error: r.value?.error || r.reason };
					}
				}
			}

			// 4.b) Insertar nuevos (sin upsert, dado que no existen aún por chequeo previo)
			if (toInsert.length > 0) {
				const { error: insertErr } = await supabase
					.from('productos_sucursal')
					.insert(toInsert);
				if (insertErr) {
					return { success: false, message: 'Error al insertar nuevos stocks', error: insertErr };
				}
			}

		return { success: true, message: 'Stock reemplazado correctamente', data: { actualizados: toUpdate.length, insertados: toInsert.length } };
	} catch (error) {
		console.error('Error en ConteosModel.replaceStock:', error);
		return { success: false, message: 'Error interno del servidor', error };
	}
}

// Reemplazar stock de productos_acopio con el valor "fisico" del conteo (solo para tipo 'acopio')
static async replaceStockAcopio(conteoId) {
	try {
		if (!conteoId) {
			return { success: false, message: 'ID del conteo es requerido' };
		}

		// 1) Obtener encabezado de conteo para validar tipo
		const { data: conteo, error: conteoErr } = await supabase
			.from('conteos')
			.select('id, tipo')
			.eq('id', conteoId)
			.single();

		if (conteoErr || !conteo) {
			return { success: false, message: 'Conteo no encontrado' };
		}

		if ((conteo.tipo || '').toString().trim().toLowerCase() !== 'acopio') {
			return { success: false, message: 'Reemplazo disponible solo para conteos de acopio' };
		}

		// 2) Obtener detalles del conteo (producto_acopio_id, fisico)
		const { data: detalles, error: detErr } = await supabase
			.from('conteo_detalle')
			.select('producto_acopio_id, fisico')
			.eq('conteo_id', conteoId)
			.not('producto_acopio_id', 'is', null);

		if (detErr) {
			return { success: false, message: 'Error al obtener detalles del conteo', error: detErr };
		}

		if (!detalles || detalles.length === 0) {
			return { success: false, message: 'El conteo no tiene detalles de acopio' };
		}

		// Normalizar datos de reemplazo con manejo cuidadoso de decimales
		const productIdToFisico = new Map();
		for (const d of detalles) {
			if (!d.producto_acopio_id) continue;
			const fisico = Number(d.fisico);
			// Usar parseFloat para mantener precisión decimal
			productIdToFisico.set(d.producto_acopio_id, Number.isFinite(fisico) ? parseFloat(fisico.toFixed(2)) : 0);
		}

		const productIds = Array.from(productIdToFisico.keys());

		// 3) Actualizar el campo quantity en products_acopio para cada producto
		const updateOps = [];
		for (const productId of productIds) {
			const fisico = productIdToFisico.get(productId) ?? 0;
			updateOps.push(
				supabase
					.from('products_acopio')
					.update({ quantity: fisico })
					.eq('id', productId)
			);
		}

		// 4) Ejecutar todas las actualizaciones en paralelo
		const updateResults = await Promise.allSettled(updateOps);
		
		// Verificar si alguna actualización falló
		for (const result of updateResults) {
			if (result.status === 'rejected' || result.value?.error) {
				return { 
					success: false, 
					message: 'Error al actualizar stock de productos de acopio', 
					error: result.value?.error || result.reason 
				};
			}
		}

		return { 
			success: true, 
			message: 'Stock de acopio reemplazado correctamente', 
			data: { actualizados: productIds.length } 
		};
	} catch (error) {
		console.error('Error en ConteosModel.replaceStockAcopio:', error);
		return { success: false, message: 'Error interno del servidor', error };
	}
}
}

module.exports = ConteosModel;


