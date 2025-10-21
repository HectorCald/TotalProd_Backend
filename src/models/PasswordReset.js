const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

class PasswordReset {
  constructor(data) {
    this.user_id = data.user_id;
    this.token = data.token;
    this.expiration = data.expiration;
    this.used = data.used;
    this.created_at = data.created_at;
    this.plain_token = data.plain_token; // Agregar esta línea
  }

  // Método estático para crear un reset de contraseña
  static async create(userId) {
    try {
      // Generar código de 6 dígitos único
      const plainToken = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Encriptar el código antes de guardarlo en la base de datos
      const saltRounds = 10;
      const hashedToken = await bcrypt.hash(plainToken, saltRounds);
      
      // Establecer expiración (1 hora desde ahora)
      const expiration = new Date();
      expiration.setHours(expiration.getHours() + 1);

      const resetData = {
        user_id: userId,
        token: hashedToken, // Guardar el token encriptado
        plain_token: plainToken, // Guardar el token plano temporalmente para retornarlo
        expiration: expiration.toISOString(),
        used: false
      };

      // Insertar en la tabla password_resets (sin plain_token)
      const { data: insertedReset, error } = await supabase
        .from('password_resets')
        .upsert([{
          user_id: userId,
          token: hashedToken,
          expiration: expiration.toISOString(),
          used: false
        }], { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear reset de contraseña:', error);
        throw new Error(`Error al crear reset de contraseña: ${error.message}`);
      }

      // Crear objeto con el token plano para retornarlo
      const resetWithPlainToken = {
        ...insertedReset,
        plain_token: plainToken
      };

      console.log('🔍 DEBUG - Token generado:', plainToken);
      console.log('🔍 DEBUG - Objeto creado:', resetWithPlainToken);

      return new PasswordReset(resetWithPlainToken);
    } catch (error) {
      console.error('💥 Error en create:', error);
      throw new Error(`Error al crear reset de contraseña: ${error.message}`);
    }
  }

  // Método estático para verificar token
  static async verifyToken(plainToken) {
    try {
      console.log('🔍 DEBUG - Verificando token:', plainToken);
      
      // Buscar todos los resets no usados
      const { data: resets, error } = await supabase
        .from('password_resets')
        .select('*')
        .eq('used', false);

      if (error) {
        console.error('Error al buscar resets:', error);
        throw new Error('No se pudo buscar los resets');
      }

      console.log('🔍 DEBUG - Resets encontrados:', resets.length);

      // Buscar el reset que coincida con el token encriptado
      let validReset = null;
      for (const reset of resets) {
        console.log('🔍 DEBUG - Comparando con reset:', reset.user_id);
        // Comparar el token plano con el hash guardado
        const isValid = await bcrypt.compare(plainToken, reset.token);
        if (isValid) {
          console.log('🔍 DEBUG - Token válido encontrado para user:', reset.user_id);
          validReset = reset;
          break;
        }
      }

      if (!validReset) {
        console.log('🔍 DEBUG - Token no válido o no encontrado');
        return null; // Token no encontrado o inválido
      }

      // Verificar si el token ha expirado
      if (new Date() > new Date(validReset.expiration)) {
        console.log('🔍 DEBUG - Token expirado');
        return null; // Token expirado
      }

      console.log('🔍 DEBUG - Token verificado exitosamente');
      
      // Crear objeto con el token plano para que el frontend pueda usarlo
      const resetWithPlainToken = {
        ...validReset,
        plain_token: plainToken // Agregar el token plano que se usó para verificar
      };
      
      return new PasswordReset(resetWithPlainToken);
    } catch (error) {
      console.error('Error al verificar token:', error);
      throw new Error('No se pudo verificar el token');
    }
  }

  // Método estático para marcar token como usado
  static async markAsUsed(plainToken) {
    try {
      // Primero encontrar el reset usando el token plano
      const reset = await this.verifyToken(plainToken);
      if (!reset) {
        throw new Error('Token no válido para marcar como usado');
      }

      // Marcar como usado usando el user_id del reset
      const { data: updatedReset, error } = await supabase
        .from('password_resets')
        .update({ used: true })
        .eq('user_id', reset.user_id)
        .select()
        .single();

      if (error) {
        console.error('Error al marcar token como usado:', error);
        throw new Error('No se pudo marcar el token como usado');
      }

      return new PasswordReset(updatedReset);
    } catch (error) {
      console.error('Error al marcar token como usado:', error);
      throw new Error('No se pudo marcar el token como usado');
    }
  }

  // Método estático para limpiar tokens expirados
  static async cleanExpiredTokens() {
    try {
      // Crear timestamp en zona horaria de Bolivia (GMT-4)
      const ahora = new Date();
      const ahoraBolivia = new Date(ahora.toLocaleString("en-US", {timeZone: "America/La_Paz"}));

      const { error } = await supabase
        .from('password_resets')
        .delete()
        .lt('expiration', ahoraBolivia.toISOString()); // Usar timestamp en zona horaria de Bolivia

      if (error) {
        console.error('Error al limpiar tokens expirados:', error);
        throw new Error('No se pudieron limpiar los tokens expirados');
      }

      return true;
    } catch (error) {
      console.error('Error al limpiar tokens expirados:', error);
      throw new Error('No se pudieron limpiar los tokens expirados');
    }
  }
}

module.exports = PasswordReset;
