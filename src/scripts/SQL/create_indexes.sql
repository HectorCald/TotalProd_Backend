-- ÍNDICES PARA OPTIMIZAR PERFORMANCE
-- Ejecutar estos comandos UNO POR UNO (no pueden ejecutarse en transacción)

-- 1. Índice optimizado para productos_sucursal
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_sucursal_lookup_optimized 
ON productos_sucursal(sucursal_id, producto_id) 
INCLUDE (stock, id);

-- 2. Índice optimizado para movimiento_almacen_producto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mov_almacen_producto_movimiento_optimized 
ON movimiento_almacen_producto(movimiento_almacen_id) 
INCLUDE (producto_almacen_id, cantidad, precio_unitario);

-- 3. Índice optimizado para movimientos_almacen
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_almacen_sucursal_fecha_optimized 
ON movimientos_almacen(sucu_id, fecha DESC) 
INCLUDE (id, type, estado);

-- 4. Actualizar estadísticas de las tablas
ANALYZE movimientos_almacen;
ANALYZE movimiento_almacen_producto;
ANALYZE productos_sucursal;
