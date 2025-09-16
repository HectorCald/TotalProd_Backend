const Personal = require('../models/Personal');

class PersonalController {
  // Obtener todos los personal de una empresa
  static async getAll(req, res) {
    try {
      // Obtener el empresa_id de la query
      const empresaId = req.query.empresa_id;
      
      if (!empresaId) {
        return res.status(400).json({
          success: false,
          message: 'ID de la empresa es requerido'
        });
      }

      // Parámetros de paginación y búsqueda
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const search = req.query.search || '';
      const offset = (page - 1) * limit;

      const result = await Personal.getAllPaginated(empresaId, { page, limit, offset, search });
      
      res.status(200).json({
        success: true,
        message: 'Personal obtenido exitosamente',
        data: result.personal,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(result.total / limit),
          totalItems: result.total,
          hasNextPage: page < Math.ceil(result.total / limit),
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Error en getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Obtener personal por ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del personal es requerido'
        });
      }

      const personal = await Personal.getById(id);

      if (!personal) {
        return res.status(404).json({
          success: false,
          message: 'Personal no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Personal obtenido exitosamente',
        data: personal
      });
    } catch (error) {
      console.error('Error en getById:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Crear personal
  static async create(req, res) {
    try {
      const { first_name, last_name, codigo, sucursal_id, modules = [], permisos = {} } = req.body;
      const empresaId = req.body.empresa_id;

      // Validar campos requeridos
      if (!first_name || !last_name || !codigo || !empresaId) {
        return res.status(400).json({
          success: false,
          message: 'Nombre, apellido, código y empresa son requeridos'
        });
      }

      // Validar longitud del código
      if (codigo.length !== 8) {
        return res.status(400).json({
          success: false,
          message: 'El código debe tener exactamente 8 caracteres'
        });
      }

      // Validar que se seleccione al menos un submódulo
      if (!modules || modules.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe seleccionar al menos un submódulo'
        });
      }

      const personalData = {
        first_name,
        last_name,
        codigo,
        empresa_id: empresaId,
        sucursal_id: sucursal_id || null,
        modules,
        permisos
      };


      const newPersonal = await Personal.create(personalData);

      res.status(201).json({
        success: true,
        message: 'Personal creado exitosamente',
        data: newPersonal
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Actualizar personal
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { first_name, last_name, codigo, is_active, sucursal_id, modules, permisos } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del personal es requerido'
        });
      }

      // Validar longitud del código si se proporciona
      if (codigo && codigo.length !== 8) {
        return res.status(400).json({
          success: false,
          message: 'El código debe tener exactamente 8 caracteres'
        });
      }

      // Validar que se seleccione al menos un submódulo si se proporcionan
      if (modules !== undefined && modules.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Debe seleccionar al menos un submódulo'
        });
      }

      const personalData = {};
      if (first_name) personalData.first_name = first_name;
      if (last_name) personalData.last_name = last_name;
      if (codigo) personalData.codigo = codigo;
      if (is_active !== undefined) personalData.is_active = is_active;
      if (sucursal_id !== undefined) personalData.sucursal_id = sucursal_id;
      if (modules !== undefined) personalData.modules = modules;
      if (permisos !== undefined) personalData.permisos = permisos;

      const updatedPersonal = await Personal.update(id, personalData);

      res.status(200).json({
        success: true,
        message: 'Personal actualizado exitosamente',
        data: updatedPersonal
      });
    } catch (error) {
      console.error('Error en update:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Eliminar personal
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID del personal es requerido'
        });
      }

      await Personal.delete(id);

      res.status(200).json({
        success: true,
        message: 'Personal eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error en delete:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Verificar si un código existe
  static async checkCodigo(req, res) {
    try {
      const { codigo, empresa_id, exclude_id } = req.query;

      if (!codigo || !empresa_id) {
        return res.status(400).json({
          success: false,
          message: 'Código y empresa son requeridos'
        });
      }

      const exists = await Personal.codigoExists(codigo, empresa_id, exclude_id);

      res.status(200).json({
        success: true,
        data: {
          exists: exists
        }
      });
    } catch (error) {
      console.error('Error en checkCodigo:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

    // Validar código de empleado
    static async validateEmployeeCode(req, res) {
        try {
            const { codigo } = req.params;

      if (!codigo) {
        return res.status(400).json({
          success: false,
          message: 'Código es requerido'
        });
      }

      const personal = await Personal.getByCodigo(codigo);

      if (!personal) {
        return res.status(404).json({
          success: false,
          message: 'Código de empleado no válido'
        });
      }

      
      // Si tiene contraseña, debe estar activo para poder hacer login
      if (personal.password && !personal.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Su cuenta está inactiva. Contacte al administrador.'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Código válido',
        data: {
          personal: personal,
          hasPassword: !!personal.password
        }
      });
    } catch (error) {
      console.error('Error en validateEmployeeCode:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Establecer contraseña para empleado
  static async setPassword(req, res) {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!id || !password) {
        return res.status(400).json({
          success: false,
          message: 'ID del personal y contraseña son requeridos'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 8 caracteres'
        });
      }

      const result = await Personal.setPassword(id, password);

      res.status(200).json({
        success: true,
        message: 'Contraseña establecida exitosamente',
        data: result
      });
    } catch (error) {
      console.error('Error en setPassword:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Login de empleado
  static async loginEmployee(req, res) {
    try {
      const { codigo, password } = req.body;

      if (!codigo || !password) {
        return res.status(400).json({
          success: false,
          message: 'Código y contraseña son requeridos'
        });
      }

      const result = await Personal.loginEmployee(codigo, password);

      if (!result.success) {
        return res.status(401).json({
          success: false,
          message: result.message
        });
      }

      res.status(200).json({
        success: true,
        message: 'Login exitoso',
        data: result.data
      });
    } catch (error) {
      console.error('Error en loginEmployee:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Cambiar contraseña de empleado
  static async changePassword(req, res) {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!id || !currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'ID del personal, contraseña actual y nueva contraseña son requeridos'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 8 caracteres'
        });
      }

      const result = await Personal.changePassword(id, currentPassword, newPassword);

      res.status(200).json(result);
    } catch (error) {
      console.error('Error en changePassword:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = PersonalController;
