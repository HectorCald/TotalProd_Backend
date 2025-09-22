-- Índices críticos para rendimiento de productos y movimientos
CREATE INDEX IF NOT EXISTS idx_products_acopio_quantity ON products_acopio(quantity);
CREATE INDEX IF NOT EXISTS idx_products_acopio_id ON products_acopio(id);
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_product_id ON movimientos_acopio(product_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_date ON movimientos_acopio(date);

-- Índices para tablas de recetas de almacén
CREATE INDEX IF NOT EXISTS idx_recetas_producto_almacen_id ON recetas(producto_almacen_id);
CREATE INDEX IF NOT EXISTS idx_recetas_detalle_receta_id ON recetas_detalle(receta_id);
CREATE INDEX IF NOT EXISTS idx_recetas_detalle_producto_acopio_id ON recetas_detalle(producto_acopio_id);

-- Índices para tablas de recetas de acopio
CREATE INDEX IF NOT EXISTS idx_recetas_acopio_producto_acopio_id ON recetas_acopio(producto_acopio_id);
CREATE INDEX IF NOT EXISTS idx_recetas_acopio_detalle_receta_acopio_id ON recetas_acopio_detalle(receta_acopio_id);
CREATE INDEX IF NOT EXISTS idx_recetas_acopio_detalle_producto_acopio_id ON recetas_acopio_detalle(producto_acopio_id);

-- Índices adicionales para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_products_almacen_id ON products_almacen(id);
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_sucu_id ON movimientos_almacen(sucu_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_acopio_sucu_id ON movimientos_acopio(sucu_id);
