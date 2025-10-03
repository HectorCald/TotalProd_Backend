-- OPTIMIZACIÓN PARA MÉTODO ANULAR DE ACOPIO
-- Crear índices específicos para mejorar el rendimiento

-- 1. Índice para validar pedidos relacionados en anular acopio
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pedidos_almacen_movimientos_acopio_anular
ON pedidos_almacen(movimiento_salida_id, movimiento_entrada_id)
WHERE movimiento_salida_id IS NOT NULL OR movimiento_entrada_id IS NOT NULL;

-- 2. Índice para obtener movimiento por ID (ya debería existir, pero por si acaso)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_movimientos_acopio_id_anular
ON movimientos_acopio(id)
INCLUDE (estado, type, quantity, gasto_id, restar_ingredientes, product_id);

-- 3. Índice para obtener producto por ID
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_acopio_id_quantity
ON products_acopio(id)
INCLUDE (quantity);

-- 4. Índice para obtener recetas por producto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recetas_acopio_producto_anular
ON recetas_acopio(producto_acopio_id)
WHERE producto_acopio_id IS NOT NULL;

-- 5. Índice para obtener detalles de receta
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recetas_acopio_detalle_receta_anular
ON recetas_acopio_detalle(receta_acopio_id)
INCLUDE (cantidad, producto_acopio_id);

-- 6. Índice para actualizar productos de ingredientes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_acopio_id_update_anular
ON products_acopio(id)
INCLUDE (quantity, name);

-- Actualizar estadísticas
ANALYZE movimientos_acopio;
ANALYZE pedidos_almacen;
ANALYZE products_acopio;
ANALYZE recetas_acopio;
ANALYZE recetas_acopio_detalle;
