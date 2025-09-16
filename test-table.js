const { supabase } = require('./src/config/supabase');

async function testTable() {
    console.log('🔍 Probando tabla personal_permisos...');
    
    try {
        // Intentar hacer un select simple
        const { data, error } = await supabase
            .from('personal_permisos')
            .select('*')
            .limit(1);
            
        if (error) {
            console.error('❌ Error:', error);
        } else {
            console.log('✅ Tabla existe, datos:', data);
        }
    } catch (err) {
        console.error('❌ Error de conexión:', err);
    }
}

testTable();
