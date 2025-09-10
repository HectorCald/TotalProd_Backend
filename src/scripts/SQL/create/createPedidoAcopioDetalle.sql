CREATE TABLE pedido_acopio_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL,
    producto_id UUID NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    medida VARCHAR NOT NULL,
    CONSTRAINT pedido_acopio_detalle_pedido_id_fkey 
        FOREIGN KEY (pedido_id) REFERENCES pedidos_acopio (id) ON DELETE CASCADE,
    CONSTRAINT pedido_acopio_detalle_producto_id_fkey 
        FOREIGN KEY (producto_id) REFERENCES products_acopio (id)
);
