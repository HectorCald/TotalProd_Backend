const comentarios = require('../models/comentarios');

class comentariosController {

  // Obtener todos los comentarios
  static async getAll(req, res) {
    try {
      const comentariosData = await comentarios.getAll();
      
      // Obtener información del usuario actual del token
      const currentUserId = req.user?.id;
      const currentUserType = req.user?.type;
      const currentUserFinalId = currentUserType === 'employee' ? null : currentUserId;
      const currentUserPersonalId = currentUserType === 'employee' ? currentUserId : null;
      
      res.status(200).json({
        success: true,
        message: 'Comentarios obtenidos exitosamente',
        data: comentariosData,
        currentUser: {
          user_id: currentUserFinalId,
          personal_id: currentUserPersonalId
        }
      });
    } catch (error) {
      console.error('Error en comentariosController.getAll:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Crear un comentario
  static async create(req, res) {
    try {
      const { tipo, mensaje } = req.body;
      const userId = req.user?.id;
      const userType = req.user?.type; // Verificar si es empleado o usuario normal

      // Si es empleado, usar personal_id, si es usuario normal, usar userId
      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? userId : null;

      if (!finalUserId && !finalPersonalId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Validaciones básicas
      if (!tipo || !mensaje || !mensaje.trim()) {
        return res.status(400).json({
          success: false,
          message: 'El tipo y mensaje son obligatorios'
        });
      }

      // Validar tipo de comentario
      const tiposValidos = ['error', 'sugerencia', 'felicitacion', 'ayuda'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de comentario no válido'
        });
      }

      // Verificar límite de comentarios por día (máximo 10)
      const comentariosHoy = await comentarios.contarComentariosHoy(finalUserId, finalPersonalId);
      if (comentariosHoy >= 10) {
        return res.status(400).json({
          success: false,
          message: 'Has alcanzado el límite de 10 comentarios por día'
        });
      }

      // Crear el comentario
      const newComentario = await comentarios.create({
        user_id: finalUserId,
        personal_id: finalPersonalId,
        tipo: tipo,
        mensaje: mensaje.trim()
      });

      res.status(201).json({
        success: true,
        message: 'Comentario creado exitosamente',
        data: newComentario
      });
    } catch (error) {
      console.error('Error en create:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Crear un apoyo a un comentario
  static async createApoyo(req, res) {
    try {
      const { comentario_id } = req.body;
      const userId = req.user?.id;
      const userType = req.user?.type;

      if (!comentario_id) {
        return res.status(400).json({
          success: false,
          message: 'ID del comentario es requerido'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      // Si es empleado, usar personal_id, si es usuario normal, usar userId
      const finalUserId = userType === 'employee' ? null : userId;
      const finalPersonalId = userType === 'employee' ? userId : null;

      // Verificar si el usuario ya apoyó este comentario hoy
      const yaApoyoHoy = await comentarios.verificarApoyoHoy(comentario_id, finalUserId, finalPersonalId);
      if (yaApoyoHoy) {
        return res.status(400).json({
          success: false,
          message: 'Ya has apoyado este comentario hoy'
        });
      }

      // Verificar si el usuario está intentando apoyar su propio comentario
      const esMiComentario = await comentarios.verificarMiComentario(comentario_id, finalUserId, finalPersonalId);
      if (esMiComentario) {
        return res.status(400).json({
          success: false,
          message: 'No puedes apoyar tu propio comentario'
        });
      }

      // Crear el apoyo
      const newApoyo = await comentarios.createApoyo(comentario_id, finalUserId, finalPersonalId);

      res.status(201).json({
        success: true,
        message: 'Apoyo agregado exitosamente',
        data: newApoyo
      });
    } catch (error) {
      console.error('Error en createApoyo:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = comentariosController;
