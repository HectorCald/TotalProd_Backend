/**
 * Normaliza una cadena de búsqueda dividiéndola en tokens limpios
 * (minúsculas, sin acentos ni caracteres especiales repetidos).
 *
 * @param {string} search - Término de búsqueda.
 * @returns {string[]} Array de tokens únicos normalizados.
 */
function normalizeSearchTokens(search = '') {
    if (!search) return [];
    const normalized = search
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[-_/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return [];

    const tokens = new Set();
    normalized.split(' ').forEach(token => {
        const cleanToken = token.replace(/'/g, '');
        if (cleanToken) tokens.add(cleanToken);
    });

    return Array.from(tokens);
}

module.exports = { normalizeSearchTokens };
