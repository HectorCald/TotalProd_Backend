CREATE TABLE transferencias_almacen_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transferencia_almacen_id UUID NOT NULL,
    producto_almacen_id UUID NOT NULL,

    cantidad NUMERIC NOT NULL,
    precio_unitario NUMERIC NOT NULL,
    subtotal NUMERIC NOT NULL,

    CONSTRAINT transferencias_detalle_transferencia_fkey
        FOREIGN KEY (transferencia_almacen_id) REFERENCES transferencias_almacen (id)
        ON DELETE CASCADE,

    CONSTRAINT transferencias_detalle_producto_fkey
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id)
);

-- Índices
CREATE INDEX idx_transferencias_detalle_transferencia
    ON transferencias_almacen_detalle (transferencia_almacen_id);

CREATE INDEX idx_transferencias_detalle_producto
    ON transferencias_almacen_detalle (producto_almacen_id);
