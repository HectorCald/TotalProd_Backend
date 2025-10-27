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
    },
    // Optimizaciones para desarrollo
    realtime: {
        enabled: false // Deshabilitar realtime en desarrollo
    },
    // Configuración de timeouts y límites
    global: {
        headers: {
            'x-my-custom-header': 'my-app-name'
        }
    },
    // Configuración de timeout para operaciones
    timeout: 30000, // 30 segundos timeout
    // Configuración de límites para operaciones batch
    batchSize: 50, // Máximo 50 operaciones por lote
    maxRetries: 3, // Máximo 3 reintentos
    retryDelay: 1000 // 1 segundo entre reintentos
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

// Función auxiliar para procesar operaciones en lotes
async function processBatch(operations, batchSize = 50) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize);
        try {
            const batchResult = await Promise.allSettled(batch);
            results.push(...batchResult);
        } catch (error) {
            errors.push(error);
        }
    }
    
    return { results, errors };
}

// Función auxiliar para reintentos con delay exponencial
async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt); // Delay exponencial
                console.log(`🔄 Reintentando operación en ${delay}ms (intento ${attempt + 1}/${maxRetries + 1})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

// Función auxiliar para validar que todas las operaciones fueron exitosas
function validateBatchResults(results) {
    const failed = results.filter(result => 
        result.status === 'rejected' || 
        (result.value && result.value.error)
    );
    
    if (failed.length > 0) {
        const errorMessages = failed.map(result => 
            result.status === 'rejected' 
                ? result.reason?.message || 'Error desconocido'
                : result.value?.error?.message || 'Error desconocido'
        );
        throw new Error(`Operaciones fallidas: ${errorMessages.join(', ')}`);
    }
    
    return true;
}

module.exports = {
    supabase,
    testConnection,
    processBatch,
    retryOperation,
    validateBatchResults
};
