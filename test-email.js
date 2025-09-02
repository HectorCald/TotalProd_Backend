require('dotenv').config();
const EmailService = require('./src/services/emailService');

async function testEmail() {
  try {
    console.log('🧪 Probando servicio de email...');
    
    const emailService = new EmailService();
    
    // Verificar conexión
    const connectionOk = await emailService.verifyConnection();
    if (!connectionOk) {
      console.log('❌ No se pudo verificar la conexión de email');
      return;
    }
    
    // Enviar email de prueba
    console.log('📧 Enviando email de prueba...');
    const result = await emailService.sendPasswordResetCode(
      'hi.hector20@gmail.com', // Cambia por tu email real
      '123456',
      'Usuario Prueba'
    );
    
    if (result.success) {
      console.log('✅ Email enviado exitosamente!');
      console.log('📧 Message ID:', result.messageId);
    }
    
  } catch (error) {
    console.error('❌ Error al probar email:', error);
  }
}

testEmail();
