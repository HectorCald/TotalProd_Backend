-- Índices para optimizar consultas de pedidos_almacen
-- Estos índices mejorarán significativamente el rendimiento de las consultas más frecuentes

-- Índice para consultas por sucursal (tanto origen como destino)
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_sucursal_id ON pedidos_almacen(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_sucursal_destino_id ON pedidos_almacen(sucursal_destino_id);

-- Índice compuesto para consultas por sucursal y estado (muy frecuente)
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_sucursal_estado ON pedidos_almacen(sucursal_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_destino_estado ON pedidos_almacen(sucursal_destino_id, estado);

-- Índice para consultas por fecha (ordenamiento)
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_fecha ON pedidos_almacen(fecha DESC);

-- Índice para consultas por empresa
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_empresa_id ON pedidos_almacen(empresa_id);

-- Índice para consultas por estado
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_estado ON pedidos_almacen(estado);

-- Índice para consultas por movimiento_salida_id (para obtener método de pago)
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_movimiento_salida_id ON pedidos_almacen(movimiento_salida_id);

-- Índice para consultas por cliente
CREATE INDEX IF NOT EXISTS idx_pedidos_almacen_cliente_id ON pedidos_almacen(cliente_id);

-- Índices para pedido_almacen_detalle
-- Índice para consultas por pedido (ya existe implícitamente por FK, pero es bueno tenerlo explícito)
CREATE INDEX IF NOT EXISTS idx_pedido_almacen_detalle_pedido_id ON pedido_almacen_detalle(pedido_almacen_id);

-- Índice para consultas por producto (para verificar si un producto tiene pedidos)
CREATE INDEX IF NOT EXISTS idx_pedido_almacen_detalle_producto_id ON pedido_almacen_detalle(producto_almacen_id);

-- Índices para sucursales
-- Índice para consultas por empresa en sucursales
CREATE INDEX IF NOT EXISTS idx_sucursales_empresa_id ON sucursales(empresa_id);

-- Índice para consultas por almacen_sucursal_id (sucursales que comparten almacén)
CREATE INDEX IF NOT EXISTS idx_sucursales_almacen_sucursal_id ON sucursales(almacen_sucursal_id);

-- Índice para total_pedidos (para consultas de ranking o estadísticas)
CREATE INDEX IF NOT EXISTS idx_sucursales_total_pedidos ON sucursales(total_pedidos DESC);

-- Índices para movimientos_almacen (relacionados con pedidos)
-- Índice para consultas por sucursal y tipo
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_sucu_tipo ON movimientos_almacen(sucu_id, type);

-- Índice para consultas por fecha en movimientos
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_fecha ON movimientos_almacen(fecha DESC);

-- Índice para consultas por estado en movimientos
CREATE INDEX IF NOT EXISTS idx_movimientos_almacen_estado ON movimientos_almacen(estado);

-- Índices para products_almacen (relacionados con pedidos)
-- Índice para consultas por empresa en productos
CREATE INDEX IF NOT EXISTS idx_products_almacen_empresa_id ON products_almacen(empresa_id);

-- Índice para consultas por categoría
CREATE INDEX IF NOT EXISTS idx_products_almacen_category_id ON products_almacen(category_id);

-- Índice para búsquedas por nombre (usando gin para búsquedas de texto)
CREATE INDEX IF NOT EXISTS idx_products_almacen_name_gin ON products_almacen USING gin(to_tsvector('spanish', name));

-- Índices para users y personal (relacionados con pedidos)
-- Índice para consultas por empresa en users
CREATE INDEX IF NOT EXISTS idx_users_empresa_id ON users(empresa_id);

-- Índice para consultas por empresa en personal
CREATE INDEX IF NOT EXISTS idx_personal_empresa_id ON personal(empresa_id);

-- Índice para consultas por sucursal en personal
CREATE INDEX IF NOT EXISTS idx_personal_sucursal_id ON personal(sucursal_id);
