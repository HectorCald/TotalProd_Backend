-- CONSULTAS PARA VERIFICAR PERFORMANCE Y ESTADÍSTICAS
-- Ejecutar después de crear los índices

-- 1. Verificar estadísticas de las tablas
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

-- 2. Verificar índices existentes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('movimientos_almacen', 'productos_sucursal', 'movimiento_almacen_producto')
ORDER BY tablename, indexname;

-- 3. Verificar tamaño de las tablas
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN ('movimientos_almacen', 'productos_sucursal', 'movimiento_almacen_producto')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. Verificar si la función RPC existe
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'update_stocks_batch';
