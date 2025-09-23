const { supabase } = require('../config/supabase');

class comentarios {

  // Constructor para crear un comentario
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.personal_id = data.personal_id;
    this.tipo = data.tipo;
    this.mensaje = data.mensaje;
    this.created_at = data.created_at;
  }

  // Método para obtener todos los comentarios con sus apoyos
  static async getAll() {
    try {
      // Primero obtener todos los comentarios
      const { data: comentarios, error: comentariosError } = await supabase
        .from('comentarios')
        .select('*')
        .order('created_at', { ascending: true });

      if (comentariosError) {
        console.error('Error de Supabase:', comentariosError);
        throw new Error('No se pudo obtener los comentarios');
      }

      // Obtener conteo de apoyos y nombres de usuarios para cada comentario
      const comentariosConApoyos = await Promise.all(
        (comentarios || []).map(async (comentario) => {
          // Obtener conteo de apoyos para este comentario
          const { count, error: apoyosError } = await supabase
            .from('comentarios_apoyos')
            .select('*', { count: 'exact', head: true })
            .eq('comentario_id', comentario.id);

          if (apoyosError) {
            console.error('Error al obtener apoyos:', apoyosError);
          }

          // Obtener nombre del usuario
          let userName = 'Usuario';
          
          if (comentario.user_id) {
            // Es un usuario regular
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('first_name, last_name')
              .eq('id', comentario.user_id)
              .single();
            
            if (!userError && userData) {
              userName = `${userData.first_name} ${userData.last_name}`.trim();
            }
          } else if (comentario.personal_id) {
            // Es personal
            const { data: personalData, error: personalError } = await supabase
              .from('personal')
              .select('first_name, last_name')
              .eq('id', comentario.personal_id)
              .single();
            
            if (!personalError && personalData) {
              userName = `${personalData.first_name} ${personalData.last_name}`.trim();
            }
          }

          return {
            ...comentario,
            user_name: userName,
            apoyos: count || 0
          };
        })
      );
      
      return comentariosConApoyos;
    } catch (error) {
      console.error('Error al obtener los comentarios:', error);
      throw new Error('No se pudo obtener los comentarios');
    }
  }

  // Crear un comentario
  static async create(comentarioData) {
    try {
      // Crear timestamp en zona horaria de Bolivia (GMT-4)
      const ahora = new Date();
      const ahoraBolivia = new Date(ahora.getTime() - (4 * 60 * 60 * 1000)); // Restar 4 horas
      
      const dbData = {
        user_id: comentarioData.user_id || null,
        personal_id: comentarioData.personal_id || null,
        tipo: comentarioData.tipo,
        mensaje: comentarioData.mensaje,
        created_at: ahoraBolivia.toISOString() // Forzar timestamp en zona horaria de Bolivia
      };

      const { data, error } = await supabase
        .from('comentarios')
        .insert([dbData])
        .select();

      if (error) {
        console.error('Error de Supabase al crear comentario:', error);
        throw new Error('No se pudo crear el comentario');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo crear el comentario');
      }

      return data[0];
    } catch (error) {
      console.error('Error al crear el comentario:', error);
      throw error;
    }
  }

  // Verificar si el usuario ya apoyó este comentario hoy
  static async verificarApoyoHoy(comentarioId, userId = null, personalId = null) {
    try {
      // Usar zona horaria de Bolivia (GMT-4)
      const ahora = new Date();
      const ahoraBolivia = new Date(ahora.getTime() - (4 * 60 * 60 * 1000));
      const inicioDia = new Date(ahoraBolivia.getFullYear(), ahoraBolivia.getMonth(), ahoraBolivia.getDate());
      const finDia = new Date(ahoraBolivia.getFullYear(), ahoraBolivia.getMonth(), ahoraBolivia.getDate() + 1);

      let query = supabase
        .from('comentarios_apoyos')
        .select('id')
        .eq('comentario_id', comentarioId)
        .gte('created_at', inicioDia.toISOString())
        .lt('created_at', finDia.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      } else if (personalId) {
        query = query.eq('personal_id', personalId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error al verificar apoyo:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error al verificar apoyo:', error);
      return false;
    }
  }

  // Verificar si el comentario es del usuario actual
  static async verificarMiComentario(comentarioId, userId = null, personalId = null) {
    try {
      let query = supabase
        .from('comentarios')
        .select('id')
        .eq('id', comentarioId);

      if (userId) {
        query = query.eq('user_id', userId);
      } else if (personalId) {
        query = query.eq('personal_id', personalId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error al verificar mi comentario:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error al verificar mi comentario:', error);
      return false;
    }
  }

  // Contar comentarios del usuario hoy
  static async contarComentariosHoy(userId = null, personalId = null) {
    try {
      // Usar zona horaria de Bolivia (GMT-4)
      const ahora = new Date();
      const ahoraBolivia = new Date(ahora.getTime() - (4 * 60 * 60 * 1000));
      const inicioDia = new Date(ahoraBolivia.getFullYear(), ahoraBolivia.getMonth(), ahoraBolivia.getDate());
      const finDia = new Date(ahoraBolivia.getFullYear(), ahoraBolivia.getMonth(), ahoraBolivia.getDate() + 1);

      let query = supabase
        .from('comentarios')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', inicioDia.toISOString())
        .lt('created_at', finDia.toISOString());

      if (userId) {
        query = query.eq('user_id', userId);
      } else if (personalId) {
        query = query.eq('personal_id', personalId);
      }

      const { count, error } = await query;

      if (error) {
        console.error('Error al contar comentarios hoy:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error al contar comentarios hoy:', error);
      return 0;
    }
  }

  // Crear un apoyo a un comentario
  static async createApoyo(comentarioId, userId = null, personalId = null) {
    try {
      if (!comentarioId) {
        throw new Error('ID del comentario es requerido');
      }

      if (!userId && !personalId) {
        throw new Error('Se requiere user_id o personal_id');
      }

      // Crear timestamp en zona horaria de Bolivia (GMT-4)
      const ahora = new Date();
      const ahoraBolivia = new Date(ahora.getTime() - (4 * 60 * 60 * 1000)); // Restar 4 horas

      const dbData = {
        comentario_id: comentarioId,
        user_id: userId,
        personal_id: personalId,
        created_at: ahoraBolivia.toISOString() // Forzar timestamp en zona horaria de Bolivia
      };

      const { data, error } = await supabase
        .from('comentarios_apoyos')
        .insert([dbData])
        .select();

      if (error) {
        console.error('Error de Supabase al crear apoyo:', error);
        throw new Error('No se pudo crear el apoyo');
      }

      if (!data || data.length === 0) {
        throw new Error('No se pudo crear el apoyo');
      }

      return data[0];
    } catch (error) {
      console.error('Error al crear el apoyo:', error);
      throw error;
    }
  }
}

module.exports = comentarios;
