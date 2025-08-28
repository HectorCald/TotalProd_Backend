const { google } = require('googleapis');
require('dotenv').config();

// Configuración de autenticación con Service Account (igual que tu proyecto anterior)
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/spreadsheets"
  ]
});

// Configuración del cliente de Google Sheets
const sheets = google.sheets({ version: 'v4', auth });

// ID del spreadsheet (se obtiene de la URL)
const SPREADSHEET_ID = process.env.USUARIOS_VENTAS;

// Configuración de las hojas (sheets) del spreadsheet
const SHEETS_CONFIG = {
  USERS: process.env.GOOGLE_USERS_SHEET_NAME || 'Usuarios',
  // Puedes agregar más hojas aquí según necesites
};

module.exports = {
  sheets,
  SPREADSHEET_ID,
  SHEETS_CONFIG,
  auth
};
