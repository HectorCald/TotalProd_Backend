CREATE TABLE movimiento_almacen_producto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_almacen_id UUID NOT NULL,
    producto_almacen_id UUID NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    CONSTRAINT movimiento_almacen_producto_movimiento_id_fkey
        FOREIGN KEY (movimiento_almacen_id) REFERENCES movimientos_almacen (id) ON DELETE CASCADE,
    CONSTRAINT movimiento_almacen_producto_producto_id_fkey
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id),
    CONSTRAINT movimiento_almacen_producto_unico UNIQUE (movimiento_almacen_id, producto_almacen_id)
);