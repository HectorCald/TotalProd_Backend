/**
 * Centraliza el filtro de rango de fechas por zona horaria local de Bolivia
 * (-04:00), que antes estaba copiado a mano en cada modelo
 * (movimientosAlmacen, movimientosAcopio, gastos, deudas, pedidosAlmacen,
 * pedidosAcopio, cotizaciones, registrosProduccionDamabrava).
 *
 * No cambia el comportamiento existente: sigue siendo el mismo
 * "día completo en hora local" que ya se aplicaba en cada modelo
 * (00:00:00.000-04:00 hasta 23:59:59.999-04:00), solo que ahora vive en un
 * único lugar.
 */

// Offset fijo usado en todo el proyecto para "hora local" de Bolivia.
const BOLIVIA_OFFSET = '-04:00';

/**
 * Aplica un filtro de rango de fechas { inicio, fin } (strings 'YYYY-MM-DD')
 * a una query de Supabase sobre la columna indicada, incluyendo el día
 * completo en hora local.
 *
 * @param {object} query - Query builder de Supabase (encadenable).
 * @param {string} columna - Nombre de la columna de fecha/timestamp a filtrar.
 * @param {{inicio?: string, fin?: string}|null} filtroFecha
 * @returns {object} La misma query, con .gte()/.lte() aplicados si corresponde.
 */
function aplicarFiltroFecha(query, columna, filtroFecha) {
    if (!filtroFecha) return query;

    if (filtroFecha.inicio) {
        query = query.gte(columna, `${filtroFecha.inicio}T00:00:00.000${BOLIVIA_OFFSET}`);
    }
    if (filtroFecha.fin) {
        query = query.lte(columna, `${filtroFecha.fin}T23:59:59.999${BOLIVIA_OFFSET}`);
    }

    return query;
}

module.exports = { aplicarFiltroFecha, BOLIVIA_OFFSET };
