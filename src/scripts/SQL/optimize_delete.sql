-- OPTIMIZACIONES PARA MÉTODO DELETE
-- Ejecutar estos comandos para mejorar significativamente los tiempos de eliminación

-- 1. Índice específico para obtener movimiento por ID
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_almacen_id_estado_delete 
ON movimientos_almacen(id) 
INCLUDE (estado)
WHERE estado IN ('activo', 'finalizado', 'anulado');

-- 2. Índice específico para validar pedidos relacionados en DELETE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pedidos_almacen_movimientos_delete 
ON pedidos_almacen(movimiento_salida_id, movimiento_entrada_id) 
WHERE movimiento_salida_id IS NOT NULL OR movimiento_entrada_id IS NOT NULL;

-- 3. Índice específico para eliminar productos relacionados
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mov_almacen_producto_movimiento_delete 
ON movimiento_almacen_producto(movimiento_almacen_id) 
WHERE movimiento_almacen_id IS NOT NULL;

-- 4. Función RPC para eliminación atómica (SIN validación de pedidos)
CREATE OR REPLACE FUNCTION eliminar_movimiento_atomico(movimiento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    movimiento_exists BOOLEAN;
BEGIN
    -- Verificar que el movimiento existe y está anulado
    SELECT EXISTS(
        SELECT 1 FROM movimientos_almacen 
        WHERE id = movimiento_id 
        AND estado = 'anulado'
    ) INTO movimiento_exists;
    
    IF NOT movimiento_exists THEN
        RAISE EXCEPTION 'Movimiento no encontrado o no está anulado: %', movimiento_id;
    END IF;
    
    -- Eliminar productos relacionados
    DELETE FROM movimiento_almacen_producto 
    WHERE movimiento_almacen_id = movimiento_id;
    
    -- Eliminar movimiento principal
    DELETE FROM movimientos_almacen 
    WHERE id = movimiento_id;
    
    -- Verificar que se eliminó
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo eliminar el movimiento: %', movimiento_id;
    END IF;
END;
$$;

-- 5. Actualizar estadísticas
ANALYZE movimientos_almacen;
ANALYZE movimiento_almacen_producto;
ANALYZE pedidos_almacen;

-- 6. Verificar locks activos en tablas
SELECT 
    pid,
    state,
    query_start,
    left(query, 100) as query_preview,
    wait_event_type,
    wait_event
FROM pg_stat_activity 
WHERE state = 'active' 
AND (query LIKE '%movimientos_almacen%' OR query LIKE '%movimiento_almacen_producto%')
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

-- 7. Verificar tamaño de tablas
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables 
WHERE tablename IN ('movimientos_almacen', 'movimiento_almacen_producto', 'pedidos_almacen')
ORDER BY n_live_tup DESC;

-- 8. Verificar índices existentes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('movimientos_almacen', 'movimiento_almacen_producto', 'pedidos_almacen')
ORDER BY tablename, indexname;
