const { supabase } = require('../config/supabase');

const SELECT_TAREA = `
  *,
  staff!planificador_tareas_responsable_id_fkey (
    id,
    first_name,
    last_name,
    cargos (
      id,
      name
    )
  ),
  user:users!planificador_tareas_creado_por_user_id_fkey (
    id,
    first_name,
    last_name
  ),
  personal:staff!planificador_tareas_creado_por_personal_id_fkey (
    id,
    first_name,
    last_name
  )
`;

const mapTarea = (t) => ({
  ...t,
  responsableNombre: t.staff
    ? `${t.staff.first_name || ''} ${t.staff.last_name || ''}`.trim()
    : null,
  responsableCargo: t.staff?.cargos?.name || null,
  creadoPorNombre: t.user
    ? `${t.user.first_name || ''} ${t.user.last_name || ''}`.trim()
    : t.personal
      ? `${t.personal.first_name || ''} ${t.personal.last_name || ''}`.trim()
      : null,
});

class PlanificadorTarea {
  constructor(data) {
    this.id = data.id;
    this.created_at = data.created_at;
    this.fecha = data.fecha;
    this.frecuencia = data.frecuencia;
    this.titulo = data.titulo;
    this.detalles = data.detalles;
    this.estado = data.estado;
    this.responsable_id = data.responsable_id;
    this.empresa_id = data.empresa_id;
    this.creado_por_user_id = data.creado_por_user_id;
    this.creado_por_personal_id = data.creado_por_personal_id;
  }

  // Obtener tareas de una empresa filtradas por mes y año
  // También incluye tareas recurrentes (semanal/mensual) que empezaron antes del mes solicitado
  static async getAll(empresaId, year, month) {
    try {
      if (!empresaId) throw new Error('ID de la empresa es requerido');

      let query = supabase
        .from('planificador_tareas')
        .select(SELECT_TAREA)
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: true });

      if (year && month) {
        const y = parseInt(year, 10);
        const m = parseInt(month, 10);
        const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0);
        const lastDayStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

        query = query.or(
          `and(frecuencia.eq.unica,fecha.gte.${firstDay},fecha.lte.${lastDayStr}),` +
          `frecuencia.eq.semanal,` +
          `frecuencia.eq.mensual`
        ).lte('fecha', lastDayStr);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudieron obtener las tareas');
      }

      return (data || []).map(mapTarea);
    } catch (error) {
      console.error('Error al obtener tareas:', error);
      throw error;
    }
  }

  // Obtener tarea por ID
  static async getById(id) {
    try {
      if (!id) throw new Error('ID es requerido');

      const { data, error } = await supabase
        .from('planificador_tareas')
        .select(SELECT_TAREA)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error('No se pudo obtener la tarea');
      }

      return mapTarea(data);
    } catch (error) {
      console.error('Error al obtener tarea por ID:', error);
      throw error;
    }
  }

  // Obtener tareas por estado (y opcionalmente por responsable)
  static async getByEstado(empresaId, estado, responsableId = null) {
    try {
      if (!empresaId) throw new Error('ID de la empresa es requerido');
      if (!estado) throw new Error('Estado es requerido');

      let query = supabase
        .from('planificador_tareas')
        .select(SELECT_TAREA)
        .eq('empresa_id', empresaId);

      if (Array.isArray(estado)) {
        query = query.in('estado', estado);
      } else if (typeof estado === 'string' && estado.includes(',')) {
        query = query.in('estado', estado.split(',').map((s) => s.trim()));
      } else {
        query = query.eq('estado', estado);
      }

      if (responsableId) {
        query = query.eq('responsable_id', responsableId);
      }

      const { data, error } = await query.order('fecha', { ascending: true });

      if (error) {
        console.error('Error de Supabase:', error);
        throw new Error('No se pudieron obtener las tareas por estado');
      }

      return (data || []).map(mapTarea);
    } catch (error) {
      console.error('Error al obtener tareas por estado:', error);
      throw error;
    }
  }

  // Obtener tareas por responsable y estado
  static async getByIdEstado(empresaId, responsableId, estado = 'Pendiente') {
    return await PlanificadorTarea.getByEstado(empresaId, estado, responsableId);
  }

  // Crear una tarea
  static async create(tareaData, empresaId, creadorInfo) {
    try {
      if (!empresaId) throw new Error('ID de la empresa es requerido');
      if (!tareaData.titulo || !tareaData.titulo.trim()) throw new Error('El título es requerido');
      if (!tareaData.fecha) throw new Error('La fecha es requerida');

      const { data, error } = await supabase
        .from('planificador_tareas')
        .insert([{
          fecha: tareaData.fecha,
          frecuencia: tareaData.frecuencia || 'unica',
          titulo: tareaData.titulo.trim(),
          detalles: tareaData.detalles?.trim() || null,
          estado: tareaData.estado || 'Pendiente',
          responsable_id: tareaData.responsable_id || null,
          empresa_id: empresaId,
          creado_por_user_id: creadorInfo?.user_id || null,
          creado_por_personal_id: creadorInfo?.personal_id || null,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error de Supabase al crear tarea:', error);
        throw new Error('No se pudo crear la tarea');
      }

      return await this.getById(data.id);
    } catch (error) {
      console.error('Error al crear tarea:', error);
      throw error;
    }
  }

  // Actualizar una tarea completa
  static async update(id, tareaData) {
    try {
      if (!id) throw new Error('ID es requerido');

      const updateData = {};
      if (tareaData.fecha !== undefined) updateData.fecha = tareaData.fecha;
      if (tareaData.frecuencia !== undefined) updateData.frecuencia = tareaData.frecuencia;
      if (tareaData.titulo !== undefined) updateData.titulo = tareaData.titulo.trim();
      if (tareaData.detalles !== undefined) updateData.detalles = tareaData.detalles?.trim() || null;
      if (tareaData.estado !== undefined) updateData.estado = tareaData.estado;
      if (tareaData.responsable_id !== undefined) updateData.responsable_id = tareaData.responsable_id;

      const { error } = await supabase
        .from('planificador_tareas')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error de Supabase al actualizar tarea:', error);
        throw new Error('No se pudo actualizar la tarea');
      }

      return await this.getById(id);
    } catch (error) {
      console.error('Error al actualizar tarea:', error);
      throw error;
    }
  }

  // Actualizar solo el estado
  static async updateEstado(id, estado) {
    try {
      if (!id) throw new Error('ID es requerido');
      if (!estado) throw new Error('Estado es requerido');

      const { error } = await supabase
        .from('planificador_tareas')
        .update({ estado })
        .eq('id', id);

      if (error) {
        console.error('Error de Supabase al actualizar estado:', error);
        throw new Error('No se pudo actualizar el estado');
      }

      return await this.getById(id);
    } catch (error) {
      console.error('Error al actualizar estado de tarea:', error);
      throw error;
    }
  }

  // Eliminar una tarea
  static async delete(id) {
    try {
      if (!id) throw new Error('ID es requerido');

      const { error } = await supabase
        .from('planificador_tareas')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error de Supabase al eliminar tarea:', error);
        throw new Error('No se pudo eliminar la tarea');
      }

      return true;
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
      throw error;
    }
  }
}

module.exports = PlanificadorTarea;
