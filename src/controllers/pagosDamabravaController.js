const pagosDamabrava = require('../models/pagosDamabrava');
const { checkDeletePermission } = require('../utils/permissionsHelper');

const parseDateOnly = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }
    if (typeof value === 'string') {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const year = Number(match[1]);
            const month = Number(match[2]) - 1;
            const day = Number(match[3]);
            const date = new Date(year, month, day);
            return Number.isNaN(date.getTime()) ? null : date;
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateOnly = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatPersonaFromRequest = (user = null) => {
    if (!user) return null;

    const nestedPersonal = user.personal || user.empleado || null;
    const nestedUser = user.usuario || user.user || null;

    const firstName =
        user.first_name ||
        user.firstName ||
        nestedPersonal?.first_name ||
        nestedPersonal?.firstName ||
        nestedUser?.first_name ||
        nestedUser?.firstName ||
        '';

    const lastName =
        user.last_name ||
        user.lastName ||
        nestedPersonal?.last_name ||
        nestedPersonal?.lastName ||
        nestedUser?.last_name ||
        nestedUser?.lastName ||
        '';

    const fallback =
        user.name ||
        user.full_name ||
        user.fullName ||
        nestedPersonal?.name ||
        nestedUser?.name ||
        user.username ||
        user.email ||
        '';

    const name = `${firstName} ${lastName}`.trim() || fallback || 'Sin nombre';
    return {
        id: user.id || user.user_id || nestedPersonal?.id || nestedUser?.id || null,
        name
    };
};

class pagosDamabravaController {
    static async create(req, res) {
        try {
            const userType = req.user?.type || null;
            const empresaId = req.user?.empresa_id || req.body?.empresa_id || null;

            const inferredUserId = req.user?.user_id || req.user?.id || null;
            const inferredPersonalId = req.user?.personal_id || req.user?.personal?.id || null;

            const finalUserId = userType === 'employee' ? null : inferredUserId;
            const finalPersonalId = userType === 'employee' ? (inferredPersonalId || inferredUserId) : null;

            if (!empresaId) {
                return res.status(403).json({
                    success: false,
                    message: 'El usuario no tiene una empresa asociada.'
                });
            }

            const {
                responsable_id,
                fecha_inicio,
                fecha_fin,
                totales = {},
                registros = [],
                extras = 0,
                descuento = 0,
                aumento = 0
            } = req.body;

            console.log('[pagosDamabravaController.create] Payload recibido:', {
                responsable_id,
                fecha_inicio,
                fecha_fin,
                totales,
                registrosCount: Array.isArray(registros) ? registros.length : 0,
                extras,
                descuento,
                aumento,
                finalUserId,
                finalPersonalId,
                userType,
                empresaId
            });

            if (!responsable_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Debes seleccionar un responsable válido.'
                });
            }

            if (!fecha_inicio || !fecha_fin) {
                return res.status(400).json({
                    success: false,
                    message: 'Debes especificar el rango de fechas del pago.'
                });
            }

            const inicioDate = parseDateOnly(fecha_inicio);
            const finDate = parseDateOnly(fecha_fin);

            if (!inicioDate || !finDate || Number.isNaN(inicioDate.getTime()) || Number.isNaN(finDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Las fechas proporcionadas no son válidas.'
                });
            }

            if (inicioDate > finDate) {
                return res.status(400).json({
                    success: false,
                    message: 'La fecha de inicio no puede ser mayor que la fecha de fin.'
                });
            }

            const cernido = Number(totales.cernido) || 0;
            const sellado = Number(totales.sellado) || 0;
            const envasado = Number(totales.envasado) || 0;
            const etiquetado = Number(totales.etiquetado) || 0;
            const total = Number(totales.total) || 0;
            const extrasValor = Math.max(0, Number(extras) || 0);
            const descuentoValor = Math.max(0, Number(descuento) || 0);
            const aumentoValor = Math.max(0, Number(aumento) || 0);

            if (total <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'El total a pagar debe ser mayor a cero.'
                });
            }

            const formattedFechaInicio = formatDateOnly(inicioDate);
            const formattedFechaFin = formatDateOnly(finDate);

            if (!formattedFechaInicio || !formattedFechaFin) {
                return res.status(400).json({
                    success: false,
                    message: 'No se pudieron procesar las fechas proporcionadas.'
                });
            }

            const result = await pagosDamabrava.create({
                user_id: finalUserId,
                personal_id: finalPersonalId,
                empresa_id: empresaId,
                responsable_id,
                cernido,
                sellado,
                envasado,
                etiquetado,
                extras: extrasValor,
                descuento: descuentoValor,
                aumento: aumentoValor,
                fecha_inicio: formattedFechaInicio,
                fecha_fin: formattedFechaFin,
                total,
                estado: 'pendiente',
                registros
            });

            console.log('[pagosDamabravaController.create] Resultado modelo:', {
                success: result.success,
                hasData: !!result.data,
                dataKeys: result.data ? Object.keys(result.data) : [],
                message: result.message
            });

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'No se pudo registrar el pago.'
                });
            }

            const responseData = { ...(result.data || {}) };
            responseData.extras = Number(responseData.extras ?? extrasValor) || 0;
            responseData.descuento = Number(responseData.descuento ?? descuentoValor) || 0;
            responseData.aumento = Number(responseData.aumento ?? aumentoValor) || 0;
            responseData.total = Number(responseData.total ?? total) || 0;
            responseData.total_produccion = responseData.total;
            responseData.total_con_ajustes =
                responseData.total + responseData.aumento + responseData.extras - responseData.descuento;

            const composePersona = (persona) => {
                if (!persona) return null;
                const firstName = persona.first_name || persona.firstName || '';
                const lastName = persona.last_name || persona.lastName || '';
                const fallback = persona.name || persona.email || '';
                const name = `${firstName} ${lastName}`.trim() || fallback || null;
                return name ? { id: persona.id || persona.personal_id || persona.user_id || null, name } : null;
            };

            const personalInfo = composePersona(responseData.personal);
            const userInfo = composePersona(responseData.user);
            const responsableInfo = composePersona(responseData.responsable);
            const fallbackRegistrador = formatPersonaFromRequest(req.user);

            if (personalInfo) {
                responseData.personal = personalInfo;
            }

            if (userInfo) {
                responseData.user = userInfo;
            }

            if (responsableInfo) {
                responseData.responsable = responsableInfo;
            }

            if (userType === 'employee') {
                responseData.personal = responseData.personal || fallbackRegistrador;
                responseData.registrado_por = responseData.personal || fallbackRegistrador;
            } else {
                responseData.user = responseData.user || fallbackRegistrador;
                responseData.registrado_por = responseData.user || fallbackRegistrador;
            }

            if (!responseData.registrado_por) {
                responseData.registrado_por = responseData.personal || responseData.user || fallbackRegistrador || null;
            }

            console.log('[pagosDamabravaController.create] Respuesta enviada:', {
                registrado_por: responseData.registrado_por,
                user: responseData.user,
                personal: responseData.personal
            });

            res.status(201).json({
                success: true,
                data: responseData,
                message: 'Pago registrado correctamente.'
            });
        } catch (error) {
            console.error('[pagosDamabravaController.create] Error inesperado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor.'
            });
        }
    }

    static async getAll(req, res) {
        try {
            const empresaId = req.user?.empresa_id || req.query?.empresa_id || null;

            if (!empresaId) {
                return res.status(403).json({
                    success: false,
                    message: 'El usuario no tiene una empresa asociada.'
                });
            }

            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 30;
            const estado = req.query.estado && req.query.estado !== 'todos' ? req.query.estado : null;
            const responsableId = req.query.responsable_id || null;
            const search = req.query.search ? String(req.query.search).trim() : null;

            const result = await pagosDamabrava.getAll(empresaId, { page, limit, estado, responsableId, search });

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'No se pudieron obtener los pagos.'
                });
            }

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('[pagosDamabravaController.getAll] Error inesperado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor.'
            });
        }
    }

    static async getById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del pago es requerido.'
                });
            }

            const result = await pagosDamabrava.getById(id);

            if (!result.success) {
                return res.status(404).json({
                    success: false,
                    message: result.message || 'Pago no encontrado.'
                });
            }

            res.json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('[pagosDamabravaController.getById] Error inesperado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor.'
            });
        }
    }

    static async getRegistros(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del pago es requerido.'
                });
            }

            const result = await pagosDamabrava.getRegistros(id);

            if (!result.success) {
                console.error('[pagosDamabravaController.getRegistros] Error desde modelo:', result.error || result.message);
                return res.status(400).json({
                    success: false,
                    message: result.message || 'No se pudieron obtener los registros asociados.'
                });
            }

            console.log('[pagosDamabravaController.getRegistros] Registros retornados:', Array.isArray(result.data) ? result.data.length : 'sin datos');

            res.json({
                success: true,
                data: result.data
            });
        } catch (error) {
            console.error('[pagosDamabravaController.getRegistros] Error inesperado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor.'
            });
        }
    }

    static async updateEstado(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body || {};

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del pago es requerido.'
                });
            }

            if (!estado) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado es requerido.'
                });
            }

            const estadoNormalizado = estado.toLowerCase();

            if (!['pendiente', 'pagado'].includes(estadoNormalizado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado no válido. Usa "pendiente" o "pagado".'
                });
            }

            const result = await pagosDamabrava.updateEstado(id, estadoNormalizado);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'No se pudo actualizar el estado del pago.'
                });
            }

            res.json({
                success: true,
                data: result.data,
                message: 'Estado actualizado correctamente.'
            });
        } catch (error) {
            console.error('[pagosDamabravaController.updateEstado] Error inesperado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor.'
            });
        }
    }

    static async delete(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'ID del pago es requerido.'
                });
            }

            const userType = req.user?.type || null;
            if (userType === 'employee') {
                const personalId = req.user?.id || req.user?.personal_id || null;
                const hasPermission = await checkDeletePermission(personalId);

                if (!hasPermission) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para eliminar pagos'
                    });
                }
            }

            const result = await pagosDamabrava.delete(id);

            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    message: result.message || 'No se pudo eliminar el pago.'
                });
            }

            res.json({
                success: true,
                message: result.message || 'Pago eliminado correctamente.'
            });
        } catch (error) {
            console.error('[pagosDamabravaController.delete] Error inesperado:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor.'
            });
        }
    }
}

module.exports = pagosDamabravaController;

