-- OPTIMIZACIONES PARA CONSULTAS LENTAS EN MÉTODO ANULAR
-- Ejecutar estos comandos para solucionar los cuellos de botella restantes

-- 1. Índice específico para consulta de movimiento por ID
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_almacen_id_estado 
ON movimientos_almacen(id) 
INCLUDE (sucu_id, type, estado, restar_ingredientes, produccion_damabrava_id)
WHERE estado IN ('activo', 'finalizado', 'anulado');

-- 2. Índice específico para consulta de productos por movimiento
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mov_almacen_producto_movimiento_cantidad_optimized 
ON movimiento_almacen_producto(movimiento_almacen_id) 
INCLUDE (id, cantidad, producto_almacen_id);

-- 3. Índice específico para consulta de stocks por sucursal y productos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_sucursal_sucursal_productos_optimized 
ON productos_sucursal(sucursal_id, producto_id) 
INCLUDE (id, stock);

-- 4. Índice específico para validación de pedidos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pedidos_almacen_movimientos_optimized 
ON pedidos_almacen(movimiento_salida_id, movimiento_entrada_id) 
WHERE movimiento_salida_id IS NOT NULL OR movimiento_entrada_id IS NOT NULL;

-- 5. Función RPC optimizada para anular movimientos (VERSIÓN MEJORADA)
CREATE OR REPLACE FUNCTION anular_movimiento_batch_optimized(
    movimiento_id UUID,
    stock_updates JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    update_item JSONB;
    stock_id UUID;
    new_stock NUMERIC;
    movimiento_exists BOOLEAN;
BEGIN
    -- Verificar que el movimiento existe y no está anulado
    SELECT EXISTS(
        SELECT 1 FROM movimientos_almacen 
        WHERE id = movimiento_id 
        AND estado != 'anulado'
    ) INTO movimiento_exists;
    
    IF NOT movimiento_exists THEN
        RAISE EXCEPTION 'Movimiento no encontrado o ya anulado: %', movimiento_id;
    END IF;
    
    -- Actualizar estado del movimiento
    UPDATE movimientos_almacen 
    SET estado = 'anulado' 
    WHERE id = movimiento_id;
    
    -- Verificar que se actualizó
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo actualizar el movimiento: %', movimiento_id;
    END IF;
    
    -- Actualizar stocks en lote (solo si hay actualizaciones)
    IF stock_updates IS NOT NULL AND jsonb_array_length(stock_updates) > 0 THEN
        FOR update_item IN SELECT * FROM jsonb_array_elements(stock_updates)
        LOOP
            stock_id := (update_item->>'id')::UUID;
            new_stock := (update_item->>'stock')::NUMERIC;
            
            UPDATE productos_sucursal 
            SET stock = new_stock 
            WHERE id = stock_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION 'No se encontró el stock con ID: %', stock_id;
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- 6. Actualizar estadísticas específicas
ANALYZE movimientos_almacen;
ANALYZE movimiento_almacen_producto;
ANALYZE productos_sucursal;
ANALYZE pedidos_almacen;

-- 7. Verificar locks activos
SELECT 
    pid,
    state,
    query_start,
    left(query, 100) as query_preview,
    wait_event_type,
    wait_event
FROM pg_stat_activity 
WHERE state = 'active' 
AND query LIKE '%movimientos_almacen%'
AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

-- 8. Verificar tamaño de índices
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE tablename IN ('movimientos_almacen', 'movimiento_almacen_producto', 'productos_sucursal', 'pedidos_almacen')
ORDER BY pg_relation_size(indexrelid) DESC;

-- 9. Verificar estadísticas de consultas
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables 
WHERE tablename IN ('movimientos_almacen', 'movimiento_almacen_producto', 'productos_sucursal', 'pedidos_almacen')
ORDER BY seq_scan DESC;
