const { supabase } = require('../config/supabase');

class CompanyType {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.name
    this.tipo = data.type;
  }

  static async getAll() {
    try {
      const { data, error } = await supabase
        .from('company_type')
        .select('*');

      if (error) {
        throw new Error(error.message);
      }

      return data.map(item => new CompanyType(item));
    } catch (error) {
      throw new Error('Error al obtener tipos de empresa');
    }
  }
}

module.exports = CompanyType;
