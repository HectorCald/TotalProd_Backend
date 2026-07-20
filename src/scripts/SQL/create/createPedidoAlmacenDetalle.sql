CREATE TABLE pedido_almacen_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_almacen_id UUID NOT NULL,
    producto_almacen_id UUID NOT NULL,
    cantidad NUMERIC NOT NULL,
    precio NUMERIC NOT NULL,
    CONSTRAINT pedido_almacen_detalle_pedido_id_fkey
        FOREIGN KEY (pedido_almacen_id) REFERENCES pedidos_almacen (id) ON DELETE CASCADE,
    CONSTRAINT pedido_almacen_detalle_producto_id_fkey
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id) ON DELETE CASCADE,
    CONSTRAINT pedido_almacen_detalle_unico UNIQUE (pedido_almacen_id, producto_almacen_id)
);
