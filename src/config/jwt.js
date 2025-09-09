const jwt = require('jsonwebtoken');

// Clave secreta para firmar los tokens (en producción debería estar en variables de entorno)
const JWT_SECRET = process.env.JWT_SECRET || 'summa-secret-key-2024';

// Configuración del token
const JWT_CONFIG = {
  expiresIn: '10y', // El token expira en 10 años
  algorithm: 'HS256'
};

// Función para generar token
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, JWT_CONFIG);
};

// Función para verificar token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
  JWT_SECRET,
  JWT_CONFIG
};
