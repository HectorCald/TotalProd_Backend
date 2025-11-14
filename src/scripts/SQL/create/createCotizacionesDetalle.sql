CREATE TABLE cotizacion_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id UUID NOT NULL,
    producto_almacen_id UUID NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario NUMERIC(12,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    CONSTRAINT cotizacion_detalle_cotizacion_id_fkey
        FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones (id) ON DELETE CASCADE,
    CONSTRAINT cotizacion_detalle_producto_id_fkey
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id),
    CONSTRAINT cotizacion_detalle_unico UNIQUE (cotizacion_id, producto_almacen_id)
);
