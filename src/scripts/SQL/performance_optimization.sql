-- OPTIMIZACIONES DE PERFORMANCE PARA MOVIMIENTOS ALMACEN
-- Ejecutar estas consultas para mejorar significativamente los tiempos

-- 1. Función RPC para actualizar múltiples stocks en una sola transacción
CREATE OR REPLACE FUNCTION update_stocks_batch(stock_updates JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    update_item JSONB;
    stock_id UUID;
    new_stock NUMERIC;
BEGIN
    -- Iterar sobre cada actualización
    FOR update_item IN SELECT * FROM jsonb_array_elements(stock_updates)
    LOOP
        -- Extraer ID y nuevo stock
        stock_id := (update_item->>'id')::UUID;
        new_stock := (update_item->>'stock')::NUMERIC;
        
        -- Actualizar el stock
        UPDATE productos_sucursal 
        SET stock = new_stock 
        WHERE id = stock_id;
        
        -- Verificar que se actualizó al menos una fila
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No se encontró el registro con ID: %', stock_id;
        END IF;
    END LOOP;
END;
$$;

-- 2. Índices adicionales para optimizar consultas
-- Índice para productos_sucursal (ya existe, pero verificar)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_sucursal_lookup_optimized 
ON productos_sucursal(sucursal_id, producto_id) 
INCLUDE (stock, id);

-- Índice para movimiento_almacen_producto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mov_almacen_producto_movimiento_optimized 
ON movimiento_almacen_producto(movimiento_almacen_id) 
INCLUDE (producto_almacen_id, cantidad, precio_unitario);

-- Índice para movimientos_almacen por sucursal y fecha
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_almacen_sucursal_fecha_optimized 
ON movimientos_almacen(sucu_id, fecha DESC) 
INCLUDE (id, type, estado);

-- 3. Estadísticas de tablas (para optimizar el planificador de consultas)
ANALYZE movimientos_almacen;
ANALYZE movimiento_almacen_producto;
ANALYZE productos_sucursal;

-- 4. Configuraciones de performance (si tienes permisos de superusuario)
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET work_mem = '4MB';
-- ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- 5. Verificar estadísticas de las tablas
SELECT 
    schemaname, 
    tablename, 
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE tablename IN ('movimientos_almacen', 'productos_sucursal', 'movimiento_almacen_producto')
ORDER BY n_live_tup DESC;

-- 6. Verificar índices existentes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('movimientos_almacen', 'productos_sucursal', 'movimiento_almacen_producto')
ORDER BY tablename, indexname;
