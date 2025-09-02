const PasswordReset = require('../models/PasswordReset');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const EmailService = require('../services/emailService');

class PasswordResetController {
  // Método para solicitar reset de contraseña
  static async requestReset(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email es requerido'
        });
      }

      // Verificar si el usuario existe
      const user = await User.getByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado con ese email'
        });
      }

      console.log('🔍 Usuario encontrado:', user); // Debug
      console.log('🔍 user.firstName:', user.firstName); // Debug
      console.log('🔍 user.lastName:', user.lastName); // Debug

      // Crear token de reset
      const passwordReset = await PasswordReset.create(user.id);

      // Enviar el código por email
      try {
        const emailService = new EmailService();
        const userName = `${user.firstName || 'Usuario'} ${user.lastName || ''}`.trim();
        console.log('🔍 userName construido:', userName); // Debug
        
        await emailService.sendPasswordResetCode(
          email, 
          passwordReset.plain_token, 
          userName
        );

        console.log('📧 Email enviado exitosamente a:', email);
        console.log('🔐 CÓDIGO DE RESET GENERADO Y ENVIADO:');
        console.log('📧 Email:', email);
        console.log('👤 Usuario:', userName);
        console.log('⏰ Expira:', passwordReset.expiration);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        res.status(200).json({
          success: true,
          message: 'Código de verificación enviado a tu email',
          data: {
            email: email,
            expiresAt: passwordReset.expiration
          }
        });
      } catch (emailError) {
        console.error('❌ Error al enviar email:', emailError);
        
        // Si falla el email, retornar el código en la respuesta (solo para desarrollo)
        console.log('⚠️ Fallback: Retornando código en respuesta');
        res.status(200).json({
          success: true,
          message: 'Código de reset generado (email falló)',
          data: {
            token: passwordReset.plain_token,
            expiresAt: passwordReset.expiration
          }
        });
      }
    } catch (error) {
      console.error('Error en requestReset:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para verificar token de reset
  static async verifyResetToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token es requerido'
        });
      }

      // Verificar token
      const passwordReset = await PasswordReset.verifyToken(token);
      if (!passwordReset) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Token válido',
        data: {
          userId: passwordReset.user_id,
          token: passwordReset.plain_token, // Agregar el token para el frontend
          expiresAt: passwordReset.expiration
        }
      });
    } catch (error) {
      console.error('Error en verifyResetToken:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }

  // Método para resetear contraseña
  static async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Token y nueva contraseña son requeridos'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 8 caracteres'
        });
      }

      // Verificar token
      const passwordReset = await PasswordReset.verifyToken(token);
      if (!passwordReset) {
        return res.status(400).json({
          success: false,
          message: 'Token inválido o expirado'
        });
      }

      // Encriptar nueva contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Actualizar contraseña del usuario
      const { supabase } = require('../config/supabase');
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', passwordReset.user_id)
        .select()
        .single();

      if (error) {
        console.error('Error al actualizar contraseña:', error);
        throw new Error('No se pudo actualizar la contraseña');
      }

      // Marcar token como usado
      await PasswordReset.markAsUsed(token);

      res.status(200).json({
        success: true,
        message: 'Contraseña actualizada exitosamente',
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email
          }
        }
      });
    } catch (error) {
      console.error('Error en resetPassword:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
}

module.exports = PasswordResetController;
