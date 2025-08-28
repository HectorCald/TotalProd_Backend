const { verifyToken } = require('../config/jwt');

const requireAuth = (req, res, next) => {
  try {
    // Obtener el token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }

    // Extraer el token (remover "Bearer " del inicio)
    const token = authHeader.substring(7);
    
    // Verificar el token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Agregar la información del usuario decodificado a la request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    return res.status(401).json({
      success: false,
      message: 'Error de autenticación'
    });
  }
};

module.exports = {
  requireAuth
};
