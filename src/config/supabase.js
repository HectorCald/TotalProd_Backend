const { createClient } = require('@supabase/supabase-js');

// Inicializar el cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltan variables de entorno: SUPABASE_URL y SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
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
