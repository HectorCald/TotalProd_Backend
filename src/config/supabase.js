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
            'x-my-custom-header': 'totalprod-api',
            'x-client-info': 'totalprod/1.0.0'
        }
    },
    // Optimizaciones para desarrollo
    realtime: {
        enabled: false // Deshabilitar realtime en desarrollo
    }
});

// Configuración de límites para operaciones batch
const CONFIG = {
    // Timeout aumentado para operaciones grandes
    timeout: 60000, // 60 segundos para operaciones batch
    // Tamaño de lote optimizado (más pequeño = más estable)
    batchSize: 25, // Procesar de 25 en 25 para mejor estabilidad
    // Reintentos con backoff exponencial
    maxRetries: 5, // Más reintentos para operaciones críticas
    baseRetryDelay: 2000, // 2 segundos de delay base
    // Timeout por operación individual
    operationTimeout: 15000 // 15 segundos por operación individual
};

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

// Función auxiliar mejorada para procesar operaciones en lotes con control de concurrencia
async function processBatch(operations, customBatchSize = null) {
    const batchSize = customBatchSize || CONFIG.batchSize;
    const results = [];
    const errors = [];
    const successfulOps = [];
    
    console.log(`📦 [BATCH] Procesando ${operations.length} operaciones en lotes de ${batchSize}`);
    
    for (let i = 0; i < operations.length; i += batchSize) {
        const batchNumber = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(operations.length / batchSize);
        const batch = operations.slice(i, i + batchSize);
        
        console.log(`📦 [BATCH ${batchNumber}/${totalBatches}] Procesando ${batch.length} operaciones...`);
        
        try {
            const batchResult = await Promise.allSettled(batch);
            
            // Analizar resultados del batch
            let successCount = 0;
            let failCount = 0;
            
            batchResult.forEach((result, index) => {
                if (result.status === 'fulfilled' && !result.value?.error) {
                    successCount++;
                    successfulOps.push(i + index);
                } else {
                    failCount++;
                    errors.push({
                        index: i + index,
                        error: result.reason || result.value?.error,
                        batch: batchNumber
                    });
                }
            });
            
            results.push(...batchResult);
            
            console.log(`✅ [BATCH ${batchNumber}/${totalBatches}] Completado: ${successCount} exitosas, ${failCount} fallidas`);
            
            // Si hubo fallos en este batch, pausar antes del siguiente
            if (failCount > 0) {
                console.log(`⚠️ [BATCH] Pausando 1s debido a errores antes del siguiente batch...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
        } catch (error) {
            console.error(`❌ [BATCH ${batchNumber}/${totalBatches}] Error crítico:`, error.message);
            errors.push({
                batch: batchNumber,
                error: error,
                critical: true
            });
        }
    }
    
    const finalSuccess = results.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
    const finalFailed = operations.length - finalSuccess;
    
    console.log(`📊 [BATCH] Resumen: ${finalSuccess}/${operations.length} exitosas, ${finalFailed} fallidas`);
    
    return { 
        results, 
        errors,
        successfulOps,
        summary: {
            total: operations.length,
            successful: finalSuccess,
            failed: finalFailed,
            successRate: ((finalSuccess / operations.length) * 100).toFixed(2) + '%'
        }
    };
}

// Función auxiliar mejorada para reintentos con backoff exponencial y timeout por operación
async function retryOperation(operation, customMaxRetries = null, customBaseDelay = null) {
    const maxRetries = customMaxRetries !== null ? customMaxRetries : CONFIG.maxRetries;
    const baseDelay = customBaseDelay !== null ? customBaseDelay : CONFIG.baseRetryDelay;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Ejecutar operación con timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Operation timeout')), CONFIG.operationTimeout)
            );
            
            const operationPromise = operation();
            
            const result = await Promise.race([operationPromise, timeoutPromise]);
            
            if (attempt > 0) {
                console.log(`✅ [RETRY] Operación exitosa después de ${attempt} reintentos`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                // Delay exponencial: 2s, 4s, 8s, 16s, 32s
                const delay = baseDelay * Math.pow(2, attempt);
                const nextAttempt = attempt + 1;
                
                console.log(`🔄 [RETRY ${nextAttempt}/${maxRetries + 1}] Reintentando en ${delay}ms (Error: ${error.message})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error(`❌ [RETRY] Todos los reintentos fallaron después de ${maxRetries + 1} intentos`);
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
    validateBatchResults,
    CONFIG
};
