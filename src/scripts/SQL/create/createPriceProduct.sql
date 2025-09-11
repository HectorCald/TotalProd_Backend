CREATE TABLE price_product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_almacen_id UUID NOT NULL,
    price_id UUID NOT NULL,
    valor NUMERIC(12,2) NOT NULL,
    CONSTRAINT price_product_producto_almacen_id_fkey 
        FOREIGN KEY (producto_almacen_id) REFERENCES products_almacen (id) ON DELETE CASCADE,
    CONSTRAINT price_product_price_id_fkey 
        FOREIGN KEY (price_id) REFERENCES prices_types (id) ON DELETE CASCADE,
    CONSTRAINT price_product_unico UNIQUE (producto_almacen_id, price_id)
);
