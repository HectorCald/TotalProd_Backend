const { sheets, SPREADSHEET_ID, SHEETS_CONFIG } = require('../config/googleSheets');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.email = data.email;
    this.contrasena = data.contrasena;
    this.celular = data.celular;
    this.foto = data.foto;
    this.estado = data.estado;
    this.fechaCreacion = data.fechaCreacion;
    this.rol = data.rol
  }

  // Método estático para obtener todos los usuarios
  static async getAll() {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS_CONFIG.USERS}!A:I`, // Ajusta según tus columnas
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      // Asumiendo que la primera fila contiene los headers
      const headers = rows[0];
      
      const users = rows.slice(1).map((row, index) => {
        const userData = {};
        headers.forEach((header, i) => {
          // Normalizar headers para que coincidan con el modelo
          let normalizedHeader = header.toLowerCase();
          
          // Mapear headers específicos
          if (normalizedHeader === 'contraseña') {
            normalizedHeader = 'contrasena';
          } else if (normalizedHeader === 'creado') {
            normalizedHeader = 'fechacreacion';
          }
          
          userData[normalizedHeader] = row[i] || '';
        });
        
        return new User(userData);
      });

      return users;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw new Error('No se pudieron obtener los usuarios');
    }
  }

  // Método estático para obtener un usuario por ID
  static async getById(id) {
    try {
      const users = await this.getAll();
      const user = users.find(user => user.id == id);
      return user;
    } catch (error) {
      console.error('Error al obtener usuario por ID:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  }

  // Método estático para obtener un usuario por email
  static async getByEmail(email) {
    try {
      const users = await this.getAll();
      return users.find(user => user.email.toLowerCase() === email.toLowerCase());
    } catch (error) {
      console.error('Error al obtener usuario por email:', error);
      throw new Error('No se pudo obtener el usuario');
    }
  }

  // Método para validar credenciales de login
  static async validateCredentials(email, password) {
    try {
      const user = await this.getByEmail(email);
      if (!user) {
        return null;
      }
      
      if (!user.contrasena) {
        return null;
      }
      
      // Comparar la contraseña ingresada con la contraseña encriptada
      const isPasswordValid = await bcrypt.compare(password, user.contrasena);
      
      if (!isPasswordValid) {
        return null;
      }
      
      return user;
    } catch (error) {
      console.error('Error al validar credenciales:', error);
      throw new Error('Error en la validación de credenciales');
    }
  }

  // Método para crear un usuario
  static async create(userData) {
    try {
      // Generar ID único basándose en el ID más alto existente
      const users = await this.getAll();
      let nextIdNumber = 1;
      
      if (users.length > 0) {
        // Extraer el número del ID más alto existente
        const existingIds = users.map(user => {
          const match = user.id.match(/USERSUM-(\d+)/);
          return match ? parseInt(match[1]) : 0;
        });
        
        const maxIdNumber = Math.max(...existingIds);
        nextIdNumber = maxIdNumber + 1;
      }
      
      const nextId = `USERSUM-${String(nextIdNumber).padStart(4, '0')}`;
      
      // Preparar datos del usuario
      const newUser = {
        id: nextId,
        nombre: userData.nombre,
        email: userData.email,
        contrasena: userData.contrasena,
        celular: userData.telefono || '',
        foto: userData.foto || '',
        estado: userData.estado || 'Activo',
        fechaCreacion: userData.fechaCreacion || new Date().toISOString(),
        rol: userData.rol || 'Sin rol'
      };

      // Insertar en Google Sheets (usando los headers exactos del spreadsheet)
      const values = [
        [
          newUser.id,
          newUser.nombre,
          newUser.email,
          newUser.contrasena,
          newUser.celular,
          newUser.foto,
          newUser.estado,
          newUser.fechaCreacion,
          newUser.rol
        ]
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS_CONFIG.USERS}!A:I`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: values
        }
      });

      return new User(newUser);
    } catch (error) {
      console.error('Error al crear usuario:', error);
      throw new Error('Error al crear usuario en Google Sheets');
    }
  }

  // Método para actualizar un usuario
  static async update(id, updateData) {
    try {
      console.log('Actualizando usuario con ID:', id);
      console.log('Datos a actualizar:', updateData);
      
      // Obtener todos los usuarios para encontrar la fila correcta
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS_CONFIG.USERS}!A:H`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        throw new Error('No se encontraron usuarios en el spreadsheet');
      }

      // Encontrar la fila del usuario a actualizar
      const userRowIndex = rows.findIndex(row => row[0] === id);
      if (userRowIndex === -1) {
        throw new Error('Usuario no encontrado para actualizar');
      }

      // Obtener la fila actual del usuario
      const currentRow = rows[userRowIndex];
      const headers = rows[0];
      
      // Crear la nueva fila con los datos actualizados
      const updatedRow = headers.map((header, index) => {
        const normalizedHeader = header.toLowerCase();
        
        // Mapear headers específicos
        let mappedHeader = normalizedHeader;
        if (normalizedHeader === 'contraseña') {
          mappedHeader = 'contrasena';
        } else if (normalizedHeader === 'creado') {
          mappedHeader = 'fechacreacion';
        }
        
        // Si el campo se va a actualizar, usar el nuevo valor
        if (updateData[mappedHeader] !== undefined) {
          return updateData[mappedHeader];
        }
        
        // Si no, mantener el valor actual
        return currentRow[index] || '';
      });

      // Actualizar la fila en Google Sheets
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEETS_CONFIG.USERS}!A${userRowIndex + 1}:H${userRowIndex + 1}`,
        valueInputOption: 'RAW',
        resource: {
          values: [updatedRow]
        }
      });

      console.log('Usuario actualizado exitosamente en Google Sheets');
      
      // Retornar el usuario actualizado
      const updatedUserData = {};
      headers.forEach((header, i) => {
        const normalizedHeader = header.toLowerCase();
        let mappedHeader = normalizedHeader;
        if (normalizedHeader === 'contraseña') {
          mappedHeader = 'contrasena';
        } else if (normalizedHeader === 'creado') {
          mappedHeader = 'fechacreacion';
        }
        updatedUserData[mappedHeader] = updatedRow[i] || '';
      });

      return new User(updatedUserData);
    } catch (error) {
      console.error('Error al actualizar usuario:', error);
      throw new Error('Error al actualizar usuario en Google Sheets');
    }
  }
}

module.exports = User;
