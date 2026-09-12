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
    const fecha = new Date().toLocaleString('es-ES', { timeZone: 'America/La_Paz', dateStyle: 'long', timeStyle: 'short' });
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 560px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            padding: 32px 28px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .badge {
            display: inline-block;
            background-color: #eff6ff;
            color: #1d4ed8;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 4px 10px;
            border-radius: 9999px;
            border: 1px solid #bfdbfe;
            margin-bottom: 12px;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
          }
          .subtitle {
            font-size: 13px;
            color: #64748b;
            margin: 0 0 24px 0;
          }
          .meta-box {
            background-color: #f1f5f9;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 24px;
            font-size: 13px;
          }
          .meta-item {
            margin: 3px 0;
            color: #475569;
          }
          .meta-item strong {
            color: #1e293b;
          }
          .code-box {
            border: 1px solid #e2e8f0;
            background-color: #f8fafc;
            border-radius: 10px;
            padding: 24px 16px;
            text-align: center;
            margin: 20px 0 24px 0;
          }
          .code-label {
            font-size: 11px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
          }
          .code-value {
            font-size: 34px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #0f172a;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
          }
          .qa-card {
            border: 1px solid #f1f5f9;
            background-color: #ffffff;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 12px;
          }
          .qa-card ul {
            margin: 0;
            padding-left: 18px;
            color: #475569;
            font-size: 13px;
          }
          .qa-card li {
            margin: 4px 0;
          }
          .card-title {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            margin-bottom: 8px;
          }
          .footer {
            margin-top: 28px;
            padding-top: 16px;
            border-top: 1px solid #f1f5f9;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="badge">Seguridad</span>
          <h1>🔐 Restablecer Contraseña</h1>
          <p class="subtitle">Código de verificación para tu cuenta de TotalProd</p>

          <div class="meta-box">
            <div class="meta-item">Hola <strong>${firstName}</strong>, hemos recibido una solicitud para cambiar tu contraseña.</div>
            <div class="meta-item"><strong>Fecha:</strong> ${fecha}</div>
          </div>

          <div class="code-box">
            <div class="code-label">Código de Verificación</div>
            <div class="code-value">${code}</div>
          </div>

          <div class="qa-card">
            <div class="card-title">Información Importante</div>
            <ul>
              <li>Este código expirará en 1 hora.</li>
              <li>No compartas este código con nadie por motivos de seguridad.</li>
              <li>Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.</li>
            </ul>
          </div>

          <div class="footer">
            TotalProd &bull; Mensaje automático de seguridad
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Método para enviar resultados de encuesta de IA
  async sendEncuestaIA({ userName, userEmail, respuestas }) {
    try {
      const emailData = {
        sender: {
          name: 'TotalProd - Encuestas',
          email: process.env.FROM_EMAIL || 'hi.hector20@gmail.com'
        },
        to: [
          {
            email: 'hi.hector20@gmail.com',
            name: 'Héctor'
          }
        ],
        subject: `🤖 Nueva Encuesta IA: ${userName || 'Usuario'}`,
        htmlContent: this.generateEncuestaIAEmail({ userName, userEmail, respuestas })
      };

      const response = await this.sendEmail(emailData);
      if (!response.success) {
        throw new Error(response.error);
      }
      return response;
    } catch (error) {
      console.error('❌ Error al enviar email de encuesta IA:', error.message);
      throw new Error(`Error al enviar email: ${error.message}`);
    }
  }

  // Generar el HTML minimalista para la encuesta de IA
  generateEncuestaIAEmail({ userName, userEmail, respuestas }) {
    const fecha = new Date().toLocaleString('es-ES', { timeZone: 'America/La_Paz', dateStyle: 'long', timeStyle: 'short' });
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Encuesta IA</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            background-color: #f8fafc;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 560px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            padding: 32px 28px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .badge {
            display: inline-block;
            background-color: #f0fdf4;
            color: #166534;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 4px 10px;
            border-radius: 9999px;
            border: 1px solid #bbf7d0;
            margin-bottom: 12px;
          }
          h1 {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 4px 0;
          }
          .subtitle {
            font-size: 13px;
            color: #64748b;
            margin: 0 0 24px 0;
          }
          .meta-box {
            background-color: #f1f5f9;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 24px;
            font-size: 13px;
          }
          .meta-item {
            margin: 3px 0;
            color: #475569;
          }
          .meta-item strong {
            color: #1e293b;
          }
          .qa-card {
            border: 1px solid #f1f5f9;
            background-color: #ffffff;
            border-radius: 8px;
            padding: 14px 16px;
            margin-bottom: 12px;
          }
          .question {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            margin-bottom: 6px;
          }
          .answer {
            font-size: 14px;
            color: #0f172a;
            font-weight: 500;
            word-break: break-word;
          }
          .footer {
            margin-top: 28px;
            padding-top: 16px;
            border-top: 1px solid #f1f5f9;
            font-size: 12px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="badge">Encuesta Recibida</span>
          <h1>💡 Feedback de Inteligencia Artificial</h1>
          <p class="subtitle">Nueva respuesta registrada desde TotalProd</p>

          <div class="meta-box">
            <div class="meta-item"><strong>Respondido por:</strong> ${userName || 'Usuario Anónimo'}</div>
            ${userEmail ? `<div class="meta-item"><strong>Email:</strong> ${userEmail}</div>` : ''}
            <div class="meta-item"><strong>Fecha:</strong> ${fecha}</div>
          </div>

          <div class="qa-card">
            <div class="question">1. Área de Interés</div>
            <div class="answer">${respuestas?.area || 'No especificado'}</div>
          </div>

          <div class="qa-card">
            <div class="question">2. Tipo de Ayuda Solicitada</div>
            <div class="answer">${respuestas?.tipo_ayuda || 'No especificado'}</div>
          </div>

          <div class="qa-card">
            <div class="question">3. Funciones o Tareas Específicas</div>
            <div class="answer" style="white-space: pre-wrap;">${respuestas?.funciones || 'No especificado'}</div>
          </div>

          <div class="qa-card">
            <div class="question">4. Frecuencia de Uso Estimada</div>
            <div class="answer">${respuestas?.frecuencia || 'No especificado'}</div>
          </div>

          <div class="footer">
            TotalProd &bull; Notificación interna de sugerencias
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
