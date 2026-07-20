const { supabase } = require('../config/supabase');

class Empresa {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.propietario_id = data.propietario_id;
    this.logo_tipo = data.logo_tipo;
    this.tipo = data.tipo;
    this.codigo = data.codigo;
    this.created_at = data.created_at;
  }

  // Método estático para actualizar el tipo de empresa
  static async updateTipo(empresaId, tipo) {
    try {
      if (!empresaId || !tipo) {
        throw new Error('ID de empresa y tipo son requeridos');
      }

      // Validar que el tipo sea válido
      const tiposValidos = ['ventas', 'ventas_produccion'];
      if (!tiposValidos.includes(tipo)) {
        throw new Error('Tipo inválido. Debe ser "ventas" o "ventas_produccion"');
      }

      const { data: updatedEmpresa, error } = await supabase
        .from('empresas')
        .update({ tipo: tipo })
        .eq('id', empresaId)
        .select()
        .single();

      if (error) {
        console.error('Error al actualizar tipo de empresa:', error);
        throw new Error(`Error al actualizar tipo de empresa: ${error.message}`);
      }

      if (!updatedEmpresa) {
        throw new Error('No se pudo actualizar la empresa');
      }

      return new Empresa(updatedEmpresa);
    } catch (error) {
      console.error('Error en updateTipo:', error);
      throw new Error(`Error al actualizar tipo de empresa: ${error.message}`);
    }
  }

  // Método estático para obtener empresa por ID
  static async getById(empresaId) {
    try {
      if (!empresaId) {
        throw new Error('ID de empresa es requerido');
      }

      const { data: empresa, error } = await supabase
        .from('empresas')
        .select('*')
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
}

module.exports = Empresa;

