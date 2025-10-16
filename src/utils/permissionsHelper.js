const { supabase } = require('../config/supabase');

/**
 * Verifica si un empleado tiene permisos para eliminar
 * @param {string} personalId - ID del personal
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
const checkDeletePermission = async (personalId) => {
  try {
    if (!personalId) {
      return false;
    }

    // Consultar los permisos del personal
    const { data, error } = await supabase
      .from('personal_permisos')
      .select('can_delete')
      .eq('personal_id', personalId)
      .single();

    if (error) {
      console.error('Error al verificar permisos de eliminación:', error);
      return false;
    }

    // Si no hay datos o can_delete es false, no tiene permisos
    return data?.can_delete === true;
  } catch (error) {
    console.error('Error en checkDeletePermission:', error);
    return false;
  }
};

/**
 * Verifica si un empleado tiene permisos para anular
 * @param {string} personalId - ID del personal
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
const checkAnularPermission = async (personalId) => {
  try {
    if (!personalId) {
      return false;
    }

    // Consultar los permisos del personal
    const { data, error } = await supabase
      .from('personal_permisos')
      .select('can_anular')
      .eq('personal_id', personalId)
      .single();

    if (error) {
      console.error('Error al verificar permisos de anulación:', error);
      return false;
    }

    // Si no hay datos o can_anular es false, no tiene permisos
    return data?.can_anular === true;
  } catch (error) {
    console.error('Error en checkAnularPermission:', error);
    return false;
  }
};

/**
 * Verifica si un empleado tiene permisos para editar
 * @param {string} personalId - ID del personal
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
const checkUpdatePermission = async (personalId) => {
  try {
    if (!personalId) {
      return false;
    }

    // Consultar los permisos del personal
    const { data, error } = await supabase
      .from('personal_permisos')
      .select('can_update')
      .eq('personal_id', personalId)
      .single();

    if (error) {
      console.error('Error al verificar permisos de edición:', error);
      return false;
    }

    // Si no hay datos o can_update es false, no tiene permisos
    return data?.can_update === true;
  } catch (error) {
    console.error('Error en checkUpdatePermission:', error);
    return false;
  }
};

/**
 * Verifica si un empleado tiene permisos para crear
 * @param {string} personalId - ID del personal
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
const checkCreatePermission = async (personalId) => {
  try {
    if (!personalId) {
      return false;
    }

    // Consultar los permisos del personal
    const { data, error } = await supabase
      .from('personal_permisos')
      .select('can_create')
      .eq('personal_id', personalId)
      .single();

    if (error) {
      console.error('Error al verificar permisos de creación:', error);
      return false;
    }

    // Si no hay datos o can_create es false, no tiene permisos
    return data?.can_create === true;
  } catch (error) {
    console.error('Error en checkCreatePermission:', error);
    return false;
  }
};

/**
 * Verifica si un empleado tiene permisos para reemplazar
 * @param {string} personalId - ID del personal
 * @returns {Promise<boolean>} - true si tiene permisos, false si no
 */
const checkReplacePermission = async (personalId) => {
  try {
    if (!personalId) {
      return false;
    }

    // Consultar los permisos del personal
    const { data, error } = await supabase
      .from('personal_permisos')
      .select('can_replace')
      .eq('personal_id', personalId)
      .single();

    if (error) {
      console.error('Error al verificar permisos de reemplazo:', error);
      return false;
    }

    // Si no hay datos o can_replace es false, no tiene permisos
    return data?.can_replace === true;
  } catch (error) {
    console.error('Error en checkReplacePermission:', error);
    return false;
  }
};

module.exports = {
  checkDeletePermission,
  checkAnularPermission,
  checkUpdatePermission,
  checkCreatePermission,
  checkReplacePermission
};
