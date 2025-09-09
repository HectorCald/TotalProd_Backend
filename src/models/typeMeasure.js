const { supabase } = require('../config/supabase');

class typeMeasure {

  // Constructor para crear un producto
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.code = data.code;
  }

  // Método para obtener todos los tipos de medida
  static async getAll() {
    try {
      const { data, error } = await supabase
        .from('type_measure')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw new Error('No se pudo obtener los tipos de medida');
      }
      
      return data || [];
    } catch (error) {
      console.error('Error al obtener los tipos de medida:', error);
      throw new Error('No se pudo obtener los tipos de medida');
    }
  }

}

module.exports = typeMeasure;
