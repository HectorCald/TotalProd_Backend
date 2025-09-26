-- ========================================
-- ÍNDICES PARA OPTIMIZAR PERFORMANCE
-- ========================================

-- 1. ÍNDICES PARA PRODUCTOS_SUCURSAL (Optimizar stock updates)
CREATE INDEX IF NOT EXISTS idx_productos_sucursal_producto_sucursal 
ON productos_sucursal (producto_id, sucursal_id);

CREATE INDEX IF NOT EXISTS idx_productos_sucursal_producto_id 
ON productos_sucursal (producto_id);

CREATE INDEX IF NOT EXISTS idx_productos_sucursal_sucursal_id 
ON productos_sucursal (sucursal_id);

-- 2. ÍNDICES PARA PRICE_PRODUCT (Optimizar precios)
CREATE INDEX IF NOT EXISTS idx_price_product_producto_almacen_id 
ON price_product (producto_almacen_id);

CREATE INDEX IF NOT EXISTS idx_price_product_price_id 
ON price_product (price_id);

-- 3. ÍNDICES PARA RECETAS (Optimizar recetas)
CREATE INDEX IF NOT EXISTS idx_recetas_producto_almacen_id 
ON recetas (producto_almacen_id);

CREATE INDEX IF NOT EXISTS idx_recetas_detalle_receta_id 
ON recetas_detalle (receta_id);

-- 4. ÍNDICES PARA PRODUCTS_ALMACEN (Optimizar búsquedas principales)
CREATE INDEX IF NOT EXISTS idx_products_almacen_category_id 
ON products_almacen (category_id);

CREATE INDEX IF NOT EXISTS idx_products_almacen_codigo_barras 
ON products_almacen (codigo_barras) WHERE codigo_barras IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_almacen_name 
ON products_almacen (name);

-- 5. ÍNDICES PARA CATEGORÍAS
CREATE INDEX IF NOT EXISTS idx_category_almacen_name 
ON category_almacen (name);

-- ========================================
-- VERIFICAR ÍNDICES EXISTENTES
-- ========================================

-- Ejecutar esto para ver todos los índices existentes:
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     indexdef
-- FROM pg_indexes 
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;

-- ========================================
-- ESTADÍSTICAS DE PERFORMANCE
-- ========================================

-- Actualizar estadísticas de las tablas después de crear índices:
-- ANALYZE products_almacen;
-- ANALYZE productos_sucursal;
-- ANALYZE price_product;
-- ANALYZE recetas;
-- ANALYZE recetas_detalle;
-- ANALYZE category_almacen;

