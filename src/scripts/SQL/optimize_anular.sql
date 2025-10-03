-- OPTIMIZACIONES ESPECÍFICAS PARA MÉTODO ANULAR
-- Ejecutar estos comandos para mejorar aún más los tiempos

-- 1. Índice específico para validación de pedidos relacionados
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pedidos_almacen_movimientos 
ON pedidos_almacen(movimiento_salida_id, movimiento_entrada_id) 
WHERE movimiento_salida_id IS NOT NULL OR movimiento_entrada_id IS NOT NULL;

-- 2. Índice específico para actualización de estado de movimientos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_almacen_estado_id 
ON movimientos_almacen(id, estado) 
WHERE estado IN ('activo', 'finalizado', 'anulado');

-- 3. Índice específico para consulta de productos de movimiento
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mov_almacen_producto_movimiento_cantidad 
ON movimiento_almacen_producto(movimiento_almacen_id, producto_almacen_id, cantidad);

-- 4. Función RPC específica para anular movimientos (más eficiente)
CREATE OR REPLACE FUNCTION anular_movimiento_batch(
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
BEGIN
    -- Actualizar estado del movimiento
    UPDATE movimientos_almacen 
    SET estado = 'anulado' 
    WHERE id = movimiento_id;
    
    -- Verificar que se actualizó
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el movimiento con ID: %', movimiento_id;
    END IF;
    
    -- Actualizar stocks en lote
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
END;
$$;

-- 5. Actualizar estadísticas específicas
ANALYZE pedidos_almacen;
ANALYZE movimientos_almacen;
ANALYZE movimiento_almacen_producto;
ANALYZE productos_sucursal;

-- 6. Verificar locks activos en movimientos_almacen
SELECT 
    pid,
    state,
    query_start,
    query,
    wait_event_type,
    wait_event
FROM pg_stat_activity 
WHERE state = 'active' 
AND query LIKE '%movimientos_almacen%'
AND query NOT LIKE '%pg_stat_activity%';

-- 7. Verificar tamaño de tablas
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_stat_user_tables 
WHERE tablename IN ('movimientos_almacen', 'pedidos_almacen', 'movimiento_almacen_producto', 'productos_sucursal')
ORDER BY n_live_tup DESC;
