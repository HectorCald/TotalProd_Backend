const PlanificadorTarea = require('../models/PlanificadorTarea');
const { checkDeletePermission, checkUpdatePermission, checkCreatePermission } = require('../utils/permissionsHelper');

class planificadorController {

  static async _handleRequest(res, actionName, req, handlerFn, options = {}) {
    const {
      validateEmpresaId = false,
      validateId = false,
      checkPermission = null,
      successStatus = 200,
      successMessage = 'Operación exitosa'
    } = options;

    try {
      if (validateEmpresaId) {
        const empresaId = req.query.empresa_id || req.body.empresa_id;
        if (!empresaId) {
          return res.status(400).json({ success: false, message: 'El ID de la empresa es requerido' });
        }
      }

      if (validateId) {
        const { id } = req.params;
        if (!id) {
          return res.status(400).json({ success: false, message: 'El ID de la tarea es requerido' });
        }
      }

      if (checkPermission) {
        const userType = req.user?.type;
        if (userType === 'employee') {
          const personal_id = req.user.id;
          let hasPermission = false;
          if (checkPermission === 'create') hasPermission = await checkCreatePermission(personal_id);
          else if (checkPermission === 'update') hasPermission = await checkUpdatePermission(personal_id);
          else if (checkPermission === 'delete') hasPermission = await checkDeletePermission(personal_id);

          if (!hasPermission) {
            const t = { create: 'crear', update: 'editar', delete: 'eliminar' };
            return res.status(403).json({ success: false, message: `No tienes permisos para ${t[checkPermission]} tareas` });
          }
        }
      }

      const data = await handlerFn();
      const responseBody = { success: true, message: successMessage };
      if (data !== undefined) responseBody.data = data;

      return res.status(successStatus).json(responseBody);
    } catch (error) {
      console.error(`Error en planificadorController.${actionName}:`, error);
      return res.status(500).json({ success: false, message: error.message || 'Error inesperado' });
    }
  }

  // Extrae los IDs de creador según el tipo de usuario (admin o employee)
  static _getCreadorInfo(req) {
    const userType = req.user?.type;
    if (userType === 'employee') {
      return { user_id: null, personal_id: req.user.id };
    }
    return { user_id: req.user?.id || null, personal_id: null };
  }

  // GET /api/planificador - Obtener tareas del mes
  static async getAll(req, res) {
    return planificadorController._handleRequest(res, 'getAll', req, async () => {
      const { empresa_id, year, month } = req.query;
      return await PlanificadorTarea.getAll(empresa_id, year, month);
    }, { validateEmpresaId: true, successMessage: 'Tareas obtenidas exitosamente' });
  }

  // GET /api/planificador/:id - Obtener tarea por ID
  static async getById(req, res) {
    return planificadorController._handleRequest(res, 'getById', req, async () => {
      return await PlanificadorTarea.getById(req.params.id);
    }, { validateId: true, successMessage: 'Tarea obtenida exitosamente' });
  }

  // GET /api/planificador/estado/:estado - Obtener tareas por estado
  static async getByEstado(req, res) {
    return planificadorController._handleRequest(res, 'getByEstado', req, async () => {
      const empresaId = req.query.empresa_id;
      const { estado } = req.params;
      const responsableId = req.query.responsable_id || req.query.id;
      return await PlanificadorTarea.getByEstado(empresaId, estado, responsableId);
    }, { validateEmpresaId: true, successMessage: 'Tareas obtenidas por estado' });
  }

  // GET /api/planificador/responsable/:id/estado/:estado - Obtener tareas por responsable y estado
  static async getByIdEstado(req, res) {
    return planificadorController._handleRequest(res, 'getByIdEstado', req, async () => {
      const empresaId = req.query.empresa_id;
      const responsableId = req.params.id || req.params.responsableId || req.query.responsable_id || req.query.id;
      const estado = req.params.estado || req.query.estado || 'Pendiente';
      return await PlanificadorTarea.getByIdEstado(empresaId, responsableId, estado);
    }, { validateEmpresaId: true, successMessage: 'Tareas obtenidas por responsable y estado' });
  }

  // POST /api/planificador - Crear tarea
  static async create(req, res) {
    const { titulo, fecha, frecuencia, detalles, estado, responsable_id, empresa_id } = req.body;

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ success: false, message: 'El título es obligatorio' });
    }
    if (!fecha) {
      return res.status(400).json({ success: false, message: 'La fecha es obligatoria' });
    }

    return planificadorController._handleRequest(res, 'create', req, async () => {
      const creadorInfo = planificadorController._getCreadorInfo(req);
      return await PlanificadorTarea.create(
        { titulo, fecha, frecuencia, detalles, estado, responsable_id },
        empresa_id,
        creadorInfo
      );
    }, {
      validateEmpresaId: true,
      checkPermission: 'create',
      successStatus: 201,
      successMessage: 'Tarea creada exitosamente'
    });
  }

  // PUT /api/planificador/:id - Actualizar tarea completa
  static async update(req, res) {
    return planificadorController._handleRequest(res, 'update', req, async () => {
      const { id } = req.params;
      const { titulo, fecha, frecuencia, detalles, estado, responsable_id } = req.body;
      return await PlanificadorTarea.update(id, { titulo, fecha, frecuencia, detalles, estado, responsable_id });
    }, {
      validateId: true,
      checkPermission: 'update',
      successMessage: 'Tarea actualizada exitosamente'
    });
  }

  // PATCH /api/planificador/:id/estado - Actualizar solo el estado
  static async updateEstado(req, res) {
    return planificadorController._handleRequest(res, 'updateEstado', req, async () => {
      const { id } = req.params;
      const { estado } = req.body;
      if (!estado) throw new Error('El estado es requerido');
      return await PlanificadorTarea.updateEstado(id, estado);
    }, {
      validateId: true,
      checkPermission: 'update',
      successMessage: 'Estado actualizado exitosamente'
    });
  }

  // DELETE /api/planificador/:id - Eliminar tarea
  static async delete(req, res) {
    return planificadorController._handleRequest(res, 'delete', req, async () => {
      await PlanificadorTarea.delete(req.params.id);
    }, {
      validateId: true,
      checkPermission: 'delete',
      successMessage: 'Tarea eliminada exitosamente'
    });
  }
}

module.exports = planificadorController;
