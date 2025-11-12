const { checkInfoPermission, checkUpdatePermission } = require('../utils/permissionsHelper');

class permissionsController {
  static async getInfoPermission(req, res) {
    try {
      const userType = req.user?.type || 'user';

      // Usuarios no empleados tienen acceso por defecto
      if (userType !== 'employee') {
        return res.status(200).json({
          success: true,
          data: {
            allowed: true
          }
        });
      }

      const personalId = req.user?.id || null;

      if (!personalId) {
        return res.status(200).json({
          success: true,
          data: {
            allowed: false
          }
        });
      }

      const allowed = await checkInfoPermission(personalId);

      return res.status(200).json({
        success: true,
        data: {
          allowed: Boolean(allowed)
        }
      });
    } catch (error) {
      console.error('Error en permissionsController.getInfoPermission:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al verificar permisos de información sensible',
        error: error.message
      });
    }
  }

  static async getUpdatePermission(req, res) {
    try {
      const userType = req.user?.type || 'user';

      // Usuarios no empleados tienen acceso por defecto
      if (userType !== 'employee') {
        return res.status(200).json({
          success: true,
          data: {
            allowed: true
          }
        });
      }

      const personalId = req.user?.id || null;

      if (!personalId) {
        return res.status(200).json({
          success: true,
          data: {
            allowed: false
          }
        });
      }

      const allowed = await checkUpdatePermission(personalId);

      return res.status(200).json({
        success: true,
        data: {
          allowed: Boolean(allowed)
        }
      });
    } catch (error) {
      console.error('Error en permissionsController.getUpdatePermission:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al verificar permisos de edición',
        error: error.message
      });
    }
  }
}

module.exports = permissionsController;

