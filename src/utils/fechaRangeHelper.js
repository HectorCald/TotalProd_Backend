/**
 * Helper centralizado para manejo y filtrado de fechas en zona horaria de Bolivia (-04:00).
 * Soporta columnas de base de datos tipo 'timestamptz' y tipo 'date'.
 */

const BOLIVIA_OFFSET = '-04:00';
const BOLIVIA_TIMEZONE = 'America/La_Paz';

/**
 * Obtiene la fecha YYYY-MM-DD correspondiente a la zona horaria de Bolivia.
 * @param {string|Date} fecha 
 * @returns {string|null}
 */
function obtenerFechaBolivia(fecha = new Date()) {
    const d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', { timeZone: BOLIVIA_TIMEZONE }).format(d);
}

/**
 * Normaliza un string o Date para extraer la fecha base 'YYYY-MM-DD' en hora Bolivia.
 * @param {string|Date} fecha 
 * @returns {string|null} Fecha en formato YYYY-MM-DD o null si es inválida
 */
function extraerFechaBase(fecha) {
    if (!fecha) return null;
    if (typeof fecha === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return fecha;
        }
        const d = new Date(fecha);
        if (!isNaN(d.getTime())) {
            return obtenerFechaBolivia(d);
        }
        return fecha.substring(0, 10);
    }
    if (fecha instanceof Date && !isNaN(fecha.getTime())) {
        return obtenerFechaBolivia(fecha);
    }
    return null;
}

/**
 * Parsea un objeto query de express (req.query) para obtener { inicio, fin } estandarizado.
 * @param {object} query - req.query
 * @returns {{inicio: string|null, fin: string|null}|null}
 */
function parseFiltroFecha(query = {}) {
    if (!query) return null;
    const inicio = query.fecha_inicio || query.inicio || query.fechaStrInicio || null;
    const fin = query.fecha_fin || query.fin || query.fechaStrFin || null;

    if (!inicio && !fin) return null;

    return {
        inicio: extraerFechaBase(inicio),
        fin: extraerFechaBase(fin)
    };
}

/**
 * Aplica un filtro de rango de fechas a una query de Supabase según el tipo de columna.
 * 
 * @param {object} query - Query builder de Supabase.
 * @param {string} columna - Nombre de la columna de fecha.
 * @param {{inicio?: string, fin?: string, fecha_inicio?: string, fecha_fin?: string}|null} filtroFecha - Objeto con fechas inicio/fin.
 * @param {'timestamptz'|'date'} [tipoColumna='timestamptz'] - Tipo de columna en la base de datos.
 * @returns {object} Query builder con los filtros aplicados.
 */
function aplicarFiltroFecha(query, columna, filtroFecha, tipoColumna = 'timestamptz') {
    if (!filtroFecha) return query;

    const inicio = extraerFechaBase(filtroFecha.inicio || filtroFecha.fecha_inicio || filtroFecha.fechaStrInicio);
    const fin = extraerFechaBase(filtroFecha.fin || filtroFecha.fecha_fin || filtroFecha.fechaStrFin);

    if (tipoColumna === 'date') {
        if (inicio) query = query.gte(columna, inicio);
        if (fin) query = query.lte(columna, fin);
    } else {
        // timestamptz: día completo en hora local Bolivia (-04:00)
        if (inicio) query = query.gte(columna, `${inicio}T00:00:00.000${BOLIVIA_OFFSET}`);
        if (fin) query = query.lte(columna, `${fin}T23:59:59.999${BOLIVIA_OFFSET}`);
    }

    return query;
}

/**
 * Normaliza una fecha recibida del frontend (ej. desde InputFecha 'YYYY-MM-DD' o ISO)
 * para guardarla en base de datos con zona horaria Bolivia sin desfase.
 * 
 * @param {string|null|undefined} fecha - Fecha en formato 'YYYY-MM-DD' o ISO.
 * @param {boolean} [defaultNow=true] - Si no viene fecha, usar la actual de Bolivia.
 * @returns {string} Fecha normalizada en formato ISO con offset.
 */
function normalizarFechaEntrada(fecha, defaultNow = true) {
    if (fecha) {
        const base = extraerFechaBase(fecha);
        if (base) {
            return `${base}T12:00:00${BOLIVIA_OFFSET}`;
        }
        return fecha;
    }
    if (defaultNow) {
        const hoyBolivia = obtenerFechaBolivia(new Date());
        return `${hoyBolivia}T12:00:00${BOLIVIA_OFFSET}`;
    }
    return null;
}

module.exports = {
    BOLIVIA_OFFSET,
    BOLIVIA_TIMEZONE,
    obtenerFechaBolivia,
    extraerFechaBase,
    parseFiltroFecha,
    aplicarFiltroFecha,
    normalizarFechaEntrada
};
