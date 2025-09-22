const { supabase } = require('../config/supabase');

class TransactionHelper {
    /**
     * Ejecuta múltiples operaciones en una transacción
     * @param {Array} operations - Array de operaciones a ejecutar
     * @returns {Object} - Resultado de la transacción
     */
    static async executeTransaction(operations) {
        try {
            // Supabase no soporta transacciones explícitas, pero podemos simular
            // el comportamiento usando rollback manual en caso de error
            
            const results = [];
            let errorOccurred = false;
            let errorIndex = -1;

            // Ejecutar todas las operaciones
            for (let i = 0; i < operations.length; i++) {
                try {
                    const operation = operations[i];
                    const result = await operation();
                    results.push({ success: true, data: result, index: i });
                } catch (error) {
                    console.error(`Error en operación ${i}:`, error);
                    errorOccurred = true;
                    errorIndex = i;
                    results.push({ success: false, error, index: i });
                    break;
                }
            }

            // Si hubo error, intentar rollback de las operaciones exitosas
            if (errorOccurred) {
                console.log(`Iniciando rollback desde operación ${errorIndex}`);
                
                // Intentar rollback de las operaciones exitosas (en orden inverso)
                for (let i = errorIndex - 1; i >= 0; i--) {
                    if (results[i].success && operations[i].rollback) {
                        try {
                            await operations[i].rollback(results[i].data);
                            console.log(`Rollback exitoso para operación ${i}`);
                        } catch (rollbackError) {
                            console.error(`Error en rollback de operación ${i}:`, rollbackError);
                        }
                    }
                }

                throw new Error(`Transacción falló en operación ${errorIndex}: ${results[errorIndex].error.message}`);
            }

            return {
                success: true,
                results: results.map(r => ({ index: r.index, data: r.data })),
                message: 'Transacción completada exitosamente'
            };

        } catch (error) {
            console.error('Error en transacción:', error);
            return {
                success: false,
                error: error.message,
                message: 'Transacción falló'
            };
        }
    }

    /**
     * Ejecuta operaciones en paralelo con manejo de errores
     * @param {Array} operations - Array de operaciones a ejecutar en paralelo
     * @returns {Object} - Resultado de las operaciones
     */
    static async executeParallel(operations) {
        try {
            const promises = operations.map(async (operation, index) => {
                try {
                    const result = await operation();
                    return { success: true, data: result, index };
                } catch (error) {
                    return { success: false, error, index };
                }
            });

            const results = await Promise.all(promises);
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            if (failed.length > 0) {
                console.error('Algunas operaciones fallaron:', failed);
                return {
                    success: false,
                    successful: successful.length,
                    failed: failed.length,
                    errors: failed.map(f => ({ index: f.index, error: f.error.message })),
                    message: `${successful.length} operaciones exitosas, ${failed.length} fallaron`
                };
            }

            return {
                success: true,
                results: successful.map(r => ({ index: r.index, data: r.data })),
                message: 'Todas las operaciones completadas exitosamente'
            };

        } catch (error) {
            console.error('Error en operaciones paralelas:', error);
            return {
                success: false,
                error: error.message,
                message: 'Error ejecutando operaciones paralelas'
            };
        }
    }
}

module.exports = TransactionHelper;
