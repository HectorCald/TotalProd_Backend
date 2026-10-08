const { supabase } = require('../../config/supabase');

class Empresa {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.propietario_id = data.propietario_id;
    this.propietario = data.users || data.propietario || null;
    this.logo_tipo = data.logo_tipo;
    this.tipo = data.tipo;
    this.codigo = data.codigo;
    this.organigrama = data.organigrama || null;
    this.created_at = data.created_at;
  }

  // Método estático para obtener empresa por ID
  static async getById(empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de empresa es requerido');
      }

      const { data: empresa, error } = await supabase
        .from('empresas')
        .select(`
          *,
          users!empresas_propietario_id_fkey (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('id', empresaId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Empresa no encontrada
        }
        console.error('Error al obtener empresa por ID:', error);
        throw new Error('No se pudo obtener la empresa');
      }

      if (!empresa) {
        return null;
      }

      return new Empresa(empresa);
    } catch (error) {
      console.error('Error en getById:', error);
      throw new Error('No se pudo obtener la empresa');
    }
  }

  // Método estático para buscar empresa por código
  static async searchByCodigo(codigo) {
    try {
      if (!codigo) {
        throw new Error('Código es requerido');
      }

      const { data: empresas, error } = await supabase
        .from('empresas')
        .select('*')
        .ilike('codigo', `%${codigo}%`);

      if (error) {
        console.error('Error al buscar empresa por código:', error);
        throw new Error('No se pudo buscar la empresa');
      }

      if (!empresas || empresas.length === 0) {
        return [];
      }

      return empresas.map(empresa => new Empresa(empresa));
    } catch (error) {
      console.error('Error en searchByCodigo:', error);
      throw new Error('No se pudo buscar la empresa');
    }
  }

  // Método estático para obtener empresas disponibles
  static async getAllDisponibles(currentEmpresaId) {
    try {
      const query = supabase
        .from('empresas')
        .select('id, name, description, propietario_id, logo_tipo, tipo, created_at')
        .not('codigo', 'is', null)
        .neq('codigo', '');
        
      if (currentEmpresaId) {
        query.neq('id', currentEmpresaId);
      }

      const { data: empresas, error } = await query;

      if (error) {
        console.error('Error al obtener empresas disponibles:', error);
        throw new Error('No se pudo obtener las empresas disponibles');
      }

      if (!empresas || empresas.length === 0) {
        return [];
      }

      return empresas.map(empresa => new Empresa(empresa));
    } catch (error) {
      console.error('Error en getAllDisponibles:', error);
      throw new Error('No se pudo obtener las empresas disponibles');
    }
  }

  // Método estático para actualizar el organigrama de la empresa
  static async updateOrganigrama(empresaId, organigrama) {
    try {
      if (!empresaId) {
        throw new Error('ID de empresa es requerido');
      }

      const { data: updatedEmpresa, error } = await supabase
        .from('empresas')
        .update({ organigrama: organigrama })
        .eq('id', empresaId)
        .select()
        .single();

      if (error) {
        console.error('Error al actualizar organigrama de empresa:', error);
        throw new Error(`Error al actualizar organigrama de empresa: ${error.message}`);
      }

      if (!updatedEmpresa) {
        throw new Error('No se pudo actualizar el organigrama de la empresa');
      }

      return new Empresa(updatedEmpresa);
    } catch (error) {
      console.error('Error en updateOrganigrama:', error);
      throw new Error(`Error al actualizar organigrama de empresa: ${error.message}`);
    }
  }
}

module.exports = Empresa;

