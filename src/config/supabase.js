const { createClient } = require('@supabase/supabase-js');

// Inicializar el cliente de Supabase
const supabaseUrl = 'https://nitrxavzzadgpqlqqjwt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pdHJ4YXZ6emFkZ3BxbHFxand0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTcwMTUsImV4cCI6MjA3MjEzMzAxNX0.SQA3EZWDGyqa3zqyWaDO-Qi-LqqCgvt88YGRcvKi7e0';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-my-custom-header': 'my-app-name'
        }
    }
});

// Test de conexión
async function testConnection() {
    try {
        // Probar que podemos hacer una operación básica
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        if (authError) {
            throw new Error(`Error de autenticación: ${authError.message}`);
        }

        console.log('✅ Conexión a Supabase establecida correctamente');
        
        // Intentar una operación con la base de datos
        const { data, error: dbError } = await supabase
            .from('users')
            .select('count')
            .limit(1);

        if (dbError) {
            console.log('⚠️ Conectado pero con error en la base de datos:', dbError.message);
            return true; // Aún retornamos true porque la conexión básica funciona
        }

        console.log('📊 Base de datos accesible');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        return false;
    }
}

module.exports = {
    supabase,
    testConnection
};
