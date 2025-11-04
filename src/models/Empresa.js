const { supabase } = require('../config/supabase');

class Empresa {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.propietario_id = data.propietario_id;
    this.logo_tipo = data.logo_tipo;
    this.tipo = data.tipo;
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
}

module.exports = Empresa;

