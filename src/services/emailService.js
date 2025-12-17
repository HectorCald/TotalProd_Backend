const axios = require('axios');

class EmailService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.baseUrl = 'https://api.brevo.com/v3';
  }

  // Método genérico para enviar emails (con soporte para adjuntos)
  async sendEmail(emailData) {
    try {
      const response = await axios.post(`${this.baseUrl}/smtp/email`, emailData, {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, messageId: response.data.messageId };
    } catch (error) {
      console.error('❌ Error al enviar email via API:', error.response?.data || error.message);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Método para enviar código de reset por email usando la API de Brevo
  async sendPasswordResetCode(email, code, userName) {
    try {
      
      const firstName = userName && userName.trim() ? userName.split(' ')[0] : 'Usuario';
      
      const emailData = {
        sender: {
          name: 'TotalProd',
          email: process.env.FROM_EMAIL || 'hi.hector20@gmail.com'
        },
        to: [
          {
            email: email,
            name: firstName
          }
        ],
        subject: '🔐 Código de restablecimiento de contraseña',
        htmlContent: this.generatePasswordResetEmail(code, firstName)
      };

      const response = await this.sendEmail(emailData);
      
      if (!response.success) {
        throw new Error(response.error);
      }

      return response;
    } catch (error) {
      console.error('❌ Error al enviar email de reset:', error.message);
      throw new Error(`Error al enviar email: ${error.message}`);
    }
  }

  // Generar el HTML del email
  generatePasswordResetEmail(code, firstName) {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
          }
          .code-container {
            background-color: #f8f9fa;
            border: 2px dashed #007bff;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .code {
            font-size: 32px;
            font-weight: bold;
            color: #007bff;
            letter-spacing: 5px;
            font-family: 'Courier New', monospace;
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            color: #856404;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 14px;
          }
          .button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔐 TotalProd</div>
            <h1>Restablecer Contraseña</h1>
          </div>
          
          <p>Hola <strong>${firstName}</strong>,</p>
          
          <p>Has solicitado restablecer tu contraseña. Para continuar, utiliza el siguiente código de verificación:</p>
          
          <div class="code-container">
            <div class="code">${code}</div>
          </div>
          
          <div class="warning">
            <strong>⚠️ Importante:</strong>
            <ul>
              <li>Este código expira en 1 hora</li>
              <li>No compartas este código con nadie</li>
              <li>Si no solicitaste este cambio, ignora este email</li>
            </ul>
          </div>
          
          <p>Si tienes problemas, contacta a nuestro equipo de soporte.</p>
          
          <div class="footer">
            <p>Este es un email automático, no respondas a este mensaje.</p>
            <p>&copy; 2024 TotalProd. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Método para verificar la conexión de la API
  async verifyConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/account`, {
        headers: {
          'api-key': this.apiKey
        }
      });
      return true;
    } catch (error) {
      console.error('❌ Error al verificar conexión a API de Brevo:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = EmailService;
